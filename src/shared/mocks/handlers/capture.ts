import { http, HttpResponse } from "msw";
import { nanoid } from "nanoid";
import type {
  CaptureFace,
  CaptureLinkResponse,
  CaptureSet,
  CaptureSetCompleteRequest,
  CaptureSetCreateRequest,
  CaptureSetCreateResponse,
  CaptureTokenResponse,
} from "../../api/types";
import { accountFromRequest, advanceCheckpoint, db } from "../db";
import { captureDb, grantFromRequest, hexToBase64, MOCK_STORAGE_ORIGIN, objectPath, sha256Hex, type MockSet } from "../captureDb";
import { problem } from "./problem";
import { simulateCapture } from "./rental";

// codes.yaml capture.face_required.PHONE (목 서버 검사용)
const PHONE_REQUIRED: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "SCR0"];

function toCaptureSet(set: MockSet): CaptureSet {
  return {
    captureSetId: set.captureSetId,
    checkpointId: set.checkpointId,
    source: "PHONE",
    boothId: null,
    status: set.completed ? "UPLOADED" : "UPLOADING",
    quality: "OK",
    photos: set.photos.map((p) => ({
      face: p.face,
      light: p.light,
      camera: p.camera,
      sha256: p.sha256,
      uploaded: captureDb.objects.has(objectPath(set.captureSetId, p.face, p.light)),
      qualityOk: true,
    })),
  };
}

export const captureHandlers = [
  // auth-server: 수령 QR 발급(관리자)·교환(고객)
  http.post("*/api/v1/auth/capture-links", async ({ request }) => {
    const account = accountFromRequest(request);
    if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "권한이 없습니다");
    const { rentalId, checkpointId } = (await request.json()) as { rentalId: string; checkpointId: string };
    const link = { token: `qr-${nanoid(32)}`, rentalId, checkpointId, used: false, expiresAt: Date.now() + 60 * 60_000 };
    captureDb.links.push(link);
    const body: CaptureLinkResponse = {
      url: `${new URL(request.url).origin}/capture?t=${link.token}`,
      expiresAt: new Date(link.expiresAt).toISOString(),
    };
    return HttpResponse.json(body, { status: 201 });
  }),
  http.post("*/api/v1/auth/capture-links/exchange", async ({ request }) => {
    const account = accountFromRequest(request);
    if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    if (account.role !== "CUSTOMER") return problem(403, "FORBIDDEN", "권한이 없습니다");
    const { token } = (await request.json()) as { token: string };
    const link = captureDb.links.find((l) => l.token === token);
    if (!link || link.used || link.expiresAt <= Date.now()) {
      return problem(410, "CAPTURE_LINK_INVALID", "만료되었거나 이미 사용한 QR입니다");
    }
    const owner = captureDb.rentalOwner.get(link.rentalId);
    if (owner && owner !== account.accountId) return problem(409, "RENTAL_LINKED_TO_OTHER", "다른 계정에 연결된 렌탈입니다");
    link.used = true;
    captureDb.rentalOwner.set(link.rentalId, account.accountId);
    const accessToken = `cap.${nanoid()}`;
    captureDb.grants.set(accessToken, { rentalId: link.rentalId, checkpointId: link.checkpointId, accountId: account.accountId, expiresAt: Date.now() + 1800_000 });
    const body: CaptureTokenResponse = {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 1800,
      rentalId: link.rentalId,
      checkpointId: link.checkpointId,
    };
    return HttpResponse.json(body);
  }),

  // capture-server: 세트 생성·완료
  http.post("*/api/v1/captures/sets", async ({ request }) => {
    const grant = grantFromRequest(request);
    if (!grant) return problem(401, "UNAUTHENTICATED", "촬영 권한이 없습니다");
    const body = (await request.json()) as CaptureSetCreateRequest;
    if (body.checkpointId !== grant.checkpointId || body.rentalId !== grant.rentalId || body.source !== "PHONE") {
      return problem(403, "OUT_OF_SCOPE", "이 시점의 촬영 권한이 없습니다");
    }
    const captureSetId = nanoid();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const uploads = body.photos.map((p) => ({
      face: p.face,
      light: p.light,
      camera: p.camera,
      method: "PUT" as const,
      url: `${MOCK_STORAGE_ORIGIN}${objectPath(captureSetId, p.face, p.light)}?X-Amz-Signature=mock`,
      headers: { "Content-Type": p.contentType, "x-amz-checksum-sha256": hexToBase64(p.sha256) },
      expiresAt,
    }));
    captureDb.sets.push({ captureSetId, rentalId: body.rentalId, checkpointId: body.checkpointId, photos: body.photos, uploads, completed: false, idempotencyKey: null });
    const response: CaptureSetCreateResponse = { captureSetId, uploads };
    return HttpResponse.json(response, { status: 201 });
  }),
  http.post("*/api/v1/captures/sets/:setId/complete", async ({ request, params }) => {
    const grant = grantFromRequest(request);
    if (!grant) return problem(401, "UNAUTHENTICATED", "촬영 권한이 없습니다");
    const set = captureDb.sets.find((s) => s.captureSetId === params.setId);
    if (!set) return problem(404, "NOT_FOUND", "세트가 없습니다");
    if (set.checkpointId !== grant.checkpointId) return problem(403, "OUT_OF_SCOPE", "이 시점의 촬영 권한이 없습니다");
    const key = request.headers.get("Idempotency-Key");
    if (!key) return problem(400, "VALIDATION_FAILED", "Idempotency-Key가 필요합니다");
    const text = await request.text();
    if (set.completed) {
      if (set.idempotencyKey !== key) return problem(409, "CAPTURE_SET_CLOSED", "이미 완료된 세트입니다");
      if ((set.completeBody ?? "") !== text) return problem(422, "IDEMPOTENCY_KEY_CONFLICT", "같은 키로 다른 요청을 보냈습니다");
      return HttpResponse.json(toCaptureSet(set), { status: 202 });
    }
    const skipped = (text ? (JSON.parse(text) as CaptureSetCompleteRequest).skippedFaces : undefined) ?? {};
    if (Object.keys(skipped).some((f) => PHONE_REQUIRED.includes(f as CaptureFace))) {
      return problem(400, "VALIDATION_FAILED", "필수 면은 건너뛸 수 없습니다");
    }
    const uploaded = set.photos.filter((p) => captureDb.objects.has(objectPath(set.captureSetId, p.face, p.light)));
    const missingFaces = PHONE_REQUIRED.filter((f) => !uploaded.some((p) => p.face === f));
    if (missingFaces.length > 0) {
      return HttpResponse.json(
        { type: "about:blank", title: "촬영하지 않은 면이 있습니다", status: 409, code: "CAPTURE_FACES_MISSING", missingFaces },
        { status: 409, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    if (uploaded.some((p) => captureDb.objects.get(objectPath(set.captureSetId, p.face, p.light)) !== p.sha256)) {
      return problem(409, "CAPTURE_HASH_MISMATCH", "올린 사진이 처음 알린 사진과 다릅니다");
    }
    set.completed = true;
    set.idempotencyKey = key;
    set.completeBody = text;
    // 폰 제출이 끝나면 그 시점을 촬영됨으로 올리고, 브라우저 목에서는 등급·봉인까지 이어 간다
    const type = db.rentals.find((r) => r.rentalId === set.rentalId)?.checkpoints.find((c) => c.checkpointId === set.checkpointId)?.type;
    if (type) {
      advanceCheckpoint(set.rentalId, type, "CAPTURED");
      simulateCapture(set.rentalId, type, "captured");
    }
    return HttpResponse.json(toCaptureSet(set), { status: 202 });
  }),

  // 저장소(MinIO) 사전 서명 PUT: 서명 헤더가 없으면 403, 본문 해시를 기록한다
  http.put(`${MOCK_STORAGE_ORIGIN}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const set = captureDb.sets.find((s) => s.uploads.some((u) => new URL(u.url).pathname === url.pathname));
    const target = set?.uploads.find((u) => new URL(u.url).pathname === url.pathname);
    if (!target || request.headers.get("x-amz-checksum-sha256") !== target.headers?.["x-amz-checksum-sha256"]) {
      return new HttpResponse(null, { status: 403 });
    }
    if (Date.parse(target.expiresAt) <= Date.now()) return new HttpResponse(null, { status: 403 });
    // 서명한 체크섬과 본문 해시가 다르면 저장소가 거절한다(실제 MinIO와 같게)
    const bodyHash = await sha256Hex(await request.arrayBuffer());
    if (hexToBase64(bodyHash) !== target.headers?.["x-amz-checksum-sha256"]) return new HttpResponse(null, { status: 400 });
    captureDb.objects.set(url.pathname, bodyHash);
    return new HttpResponse(null, { status: 200 });
  }),
];

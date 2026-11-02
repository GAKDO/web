import { http, HttpResponse } from "msw";
import { nanoid } from "nanoid";
import type {
  CaptureSetCreateRequest,
  CaptureSetCreateResponse,
  CaptureTokenResponse,
} from "../../api/types";
import { accountFromRequest } from "../db";
import { captureDb, grantFromRequest, hexToBase64, MOCK_STORAGE_ORIGIN, objectPath, sha256Hex } from "../captureDb";
import { problem } from "./problem";

export const captureHandlers = [
  // auth-server: 수령 QR 교환(고객). 발급(관리자) 목은 WE2-④에서 더한다
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
    captureDb.grants.set(accessToken, { rentalId: link.rentalId, checkpointId: link.checkpointId, accountId: account.accountId });
    const body: CaptureTokenResponse = {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 1800,
      rentalId: link.rentalId,
      checkpointId: link.checkpointId,
    };
    return HttpResponse.json(body);
  }),

  // capture-server: 세트 생성(완료 목은 WE2-③에서 더한다)
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

  // 저장소(MinIO) 사전 서명 PUT: 서명 헤더가 없으면 403, 본문 해시를 기록한다
  http.put(`${MOCK_STORAGE_ORIGIN}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const set = captureDb.sets.find((s) => s.uploads.some((u) => new URL(u.url).pathname === url.pathname));
    const target = set?.uploads.find((u) => new URL(u.url).pathname === url.pathname);
    if (!target || request.headers.get("x-amz-checksum-sha256") !== target.headers?.["x-amz-checksum-sha256"]) {
      return new HttpResponse(null, { status: 403 });
    }
    if (Date.parse(target.expiresAt) <= Date.now()) return new HttpResponse(null, { status: 403 });
    captureDb.objects.set(url.pathname, await sha256Hex(await request.arrayBuffer()));
    return new HttpResponse(null, { status: 200 });
  }),
];

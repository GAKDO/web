import { http, HttpResponse } from "msw";
import { nanoid } from "nanoid";
import type { Settlement, DefectReview, DefectReviewQueueItem, DefectReviewRequest, HumanDefectRequest, Inspection, InspectionReview, PhotoDefect } from "../../api/types";
import { accountFromRequest, db } from "../db";
import { problem } from "./problem";
import { rentalDenied, rentalOfCheckpoint } from "./report";

// WE3 리포트가 로그인 JWT로 읽는 capture-server 검사 결과·사진 보기 주소 목(WE2의 촬영 목과 따로 둔다)
export const captureReportHandlers = [
  // 반납 정산서(11/10). 목은 검사 결과가 있으면 찍힘 하나짜리 예시, 없으면 계산 전(PENDING)
  http.get("*/api/v1/captures/checkpoints/:checkpointId/settlement", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const graded = db.report.inspections.get(checkpointId)?.grade;
    const base = { checkpointId, checkpointType: "RET", ruleVersion: "settlement-rules-v2", currency: "KRW", cap: 309000 } as const;
    const body: Settlement = graded
      ? { ...base, status: "READY", grade: graded, subtotal: 31000, total: 31000, notes: ["위치 비교 대신 면·종류별 흠집 수가 앞 시점보다 늘어난 만큼만, 그 면·종류에서 작은 흠집부터 신규로 계산"],
          lines: [{ defectId: `${checkpointId}-d1`, face: "TOP", class: "dent", lengthMm: 3.2, areaMm2: 6.1, amount: 31000, rule: "찍힘 5mm 미만 · 기기가의 1.5%" }] }
      : { ...base, status: "PENDING", grade: null, lines: [], subtotal: 0, total: 0, notes: ["검수·등급이 끝나면 계산됩니다"] };
    return HttpResponse.json(body);
  }),

  http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const inspection = db.report.inspections.get(checkpointId);
    return inspection ? HttpResponse.json(inspection) : problem(404, "NOT_FOUND", "검사 결과가 없습니다");
  }),

  http.get("*/api/v1/captures/checkpoints/:checkpointId/media", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const media = db.report.media.get(checkpointId);
    if (!media) return problem(404, "NOT_FOUND", "사진이 없습니다");
    // 부를 때마다 10분짜리 새 주소(계약)
    return HttpResponse.json({ ...media, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  }),

  // 사람 검수(11/8): 검수 대기 목록·확정/기각·검수 완료
  http.get("*/api/v1/captures/reviews", ({ request }) => {
    const no = adminDenied(request);
    if (no) return no;
    const status = new URL(request.url).searchParams.get("status") ?? "PENDING";
    if (status === "DISMISSED") return problem(400, "VALIDATION_FAILED", "status는 PENDING이나 CONFIRMED만 됩니다");
    const items: DefectReviewQueueItem[] = [];
    db.report.inspections.forEach((inspection) => {
      const review = summaryOf(inspection);
      if (review.pending + review.confirmed + review.dismissed === 0 && !review.open && !inspection.review?.completedAt) return;
      const open = review.completedAt === null;
      if ((status === "PENDING") !== open) return;
      items.push({
        checkpointId: inspection.checkpointId,
        rentalId: rentalOfCheckpoint(inspection.checkpointId) ?? "",
        captureSetId: `set-${inspection.checkpointId}`.slice(0, 21),
        source: "BOOTH",
        profile: inspection.profile ?? ((inspection.photoDefects ?? []).length > 0 ? "QUICK" : "FULL"),
        modelVersion: candidates(inspection)[0]?.modelVersion ?? null,
        pending: review.pending,
        confirmed: review.confirmed,
        dismissed: review.dismissed,
        completedAt: "2026-11-09T14:03:05+09:00",
        reviewCompletedAt: review.completedAt,
      });
    });
    return HttpResponse.json({ items });
  }),

  http.post("*/api/v1/captures/checkpoints/:checkpointId/reviews", async ({ request, params }) => {
    const no = adminDenied(request);
    if (no) return no;
    const inspection = db.report.inspections.get(String(params.checkpointId));
    if (!inspection) return problem(404, "NOT_FOUND", "검사 결과가 없습니다");
    if (inspection.review?.completedAt) return problem(409, "REVIEW_CLOSED", "검수가 이미 끝난 시점입니다");
    const body = (await request.json()) as DefectReviewRequest;
    const all = candidates(inspection);
    if (body.items.some((i) => !all.some((d) => d.defectId === i.defectId))) return problem(404, "NOT_FOUND", "이 시점의 후보가 아닌 흠집입니다");
    if (body.items.some((i) => (i.decision === "DISMISSED") !== !!i.reason)) return problem(400, "VALIDATION_FAILED", "기각에만 사유를 줍니다");
    const now = new Date().toISOString();
    for (const item of body.items) {
      const d = all.find((x) => x.defectId === item.defectId);
      if (!d) continue;
      d.review =
        item.decision === "PENDING"
          ? { status: "PENDING", reason: null, reviewedBy: null, reviewedAt: null }
          : { status: item.decision, reason: item.reason ?? null, reviewedBy: "admin0000000000000001", reviewedAt: now };
    }
    inspection.review = summaryOf(inspection);
    return HttpResponse.json(inspection);
  }),

  http.post("*/api/v1/captures/checkpoints/:checkpointId/reviews/complete", ({ request, params }) => {
    const no = adminDenied(request);
    if (no) return no;
    const inspection = db.report.inspections.get(String(params.checkpointId));
    if (!inspection) return problem(404, "NOT_FOUND", "검사 결과가 없습니다");
    const review = summaryOf(inspection);
    if (review.completedAt) return problem(409, "REVIEW_CLOSED", "검수가 이미 끝난 시점입니다");
    if (review.pending > 0) {
      return HttpResponse.json(
        { type: "about:blank", title: "검수하지 않은 후보가 남았습니다", status: 409, code: "REVIEW_PENDING_REMAINS", pending: review.pending },
        { status: 409, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    // 목은 등급 규칙을 흉내만 낸다: 남은 흠집(오염 제외) 중 찍힘·균열이 있으면 C, 긁힘만 있으면 B, 없으면 A
    const kept = [...candidates(inspection), ...humans(inspection)].filter((d) => d.review?.status !== "DISMISSED" && d.class !== "stain");
    inspection.grade = kept.some((d) => d.class === "dent" || d.class === "crack") ? "C" : kept.length > 0 ? "B" : "A";
    inspection.ruleVersion = "grade-rules-v1";
    inspection.reasons = [`사람 검수: 흠집 맞음 ${review.confirmed} · 흠집 아님 ${review.dismissed}`];
    inspection.review = { ...review, completedAt: new Date().toISOString(), open: false };
    return HttpResponse.json(inspection);
  }),

  // 놓친 흠집 직접 추가·지우기(11/9)
  http.post("*/api/v1/captures/checkpoints/:checkpointId/reviews/additions", async ({ request, params }) => {
    const no = adminDenied(request);
    if (no) return no;
    const inspection = db.report.inspections.get(String(params.checkpointId));
    if (!inspection) return problem(404, "NOT_FOUND", "검사 결과가 없습니다");
    if (!summaryOf(inspection).open) return problem(409, "REVIEW_CLOSED", "검수가 이미 끝난 시점입니다");
    const body = (await request.json()) as HumanDefectRequest;
    if (body.polygon.length < 3) return problem(400, "VALIDATION_FAILED", "흠집 다각형이 올바르지 않습니다");
    const added: PhotoDefect = {
      defectId: nanoid(),
      face: body.face,
      light: body.light,
      camera: body.camera,
      class: body.class,
      polygon: body.polygon,
      confidence: 1,
      modelVersion: "human",
      source: "HUMAN",
      review: { status: "CONFIRMED", reason: null, reviewedBy: "admin0000000000000001", reviewedAt: new Date().toISOString() },
    };
    inspection.photoDefects = [...(inspection.photoDefects ?? []), added];
    inspection.review = summaryOf(inspection);
    return HttpResponse.json(inspection, { status: 201 });
  }),

  http.delete("*/api/v1/captures/checkpoints/:checkpointId/reviews/additions/:defectId", ({ request, params }) => {
    const no = adminDenied(request);
    if (no) return no;
    const inspection = db.report.inspections.get(String(params.checkpointId));
    if (!inspection) return problem(404, "NOT_FOUND", "검사 결과가 없습니다");
    if (!humans(inspection).some((d) => d.defectId === params.defectId)) return problem(404, "NOT_FOUND", "직접 추가한 흠집이 없습니다");
    if (inspection.review?.completedAt) return problem(409, "REVIEW_CLOSED", "검수가 이미 끝난 시점입니다");
    inspection.photoDefects = (inspection.photoDefects ?? []).filter((d) => d.defectId !== params.defectId);
    inspection.review = summaryOf(inspection);
    return HttpResponse.json(inspection);
  }),
];

/** 관리자가 직접 더한 흠집(11/9) */
function humans(inspection: Inspection): PhotoDefect[] {
  return (inspection.photoDefects ?? []).filter((d) => d.source === "HUMAN");
}

function adminDenied(request: Request) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "관리자만 검수할 수 있습니다");
  return null;
}

type Candidate = { defectId: string; class: string; modelVersion: string; review?: DefectReview };

/** 검수 후보: review가 있는 흠집(검수 이전 결과는 후보 없음) */
function candidates(inspection: Inspection): Candidate[] {
  const list: Candidate[] = [...(inspection.photoDefects ?? []).filter((d) => d.source !== "HUMAN"), ...inspection.defects.filter((d) => d.source !== "HUMAN")];
  return list.filter((d) => d.review !== undefined);
}

function summaryOf(inspection: Inspection): InspectionReview {
  const list = candidates(inspection);
  const count = (s: DefectReview["status"]) => list.filter((d) => d.review?.status === s).length;
  const completedAt = inspection.review?.completedAt ?? null;
  // open(11/9): 목은 저장된 값이 있으면 따르고(후보 없이 검수를 기다리는 세트), 없으면 후보가 있고 완료 전일 때
  const open = completedAt === null && (inspection.review?.open ?? list.length > 0);
  return { pending: count("PENDING"), confirmed: count("CONFIRMED"), dismissed: count("DISMISSED"), completedAt, added: humans(inspection).length, open };
}

import { http, HttpResponse } from "msw";
import type { DefectReview, DefectReviewQueueItem, DefectReviewRequest, Inspection, InspectionReview } from "../../api/types";
import { accountFromRequest, db } from "../db";
import { problem } from "./problem";
import { rentalDenied, rentalOfCheckpoint } from "./report";

// WE3 리포트가 로그인 JWT로 읽는 capture-server 검사 결과·사진 보기 주소 목(WE2의 촬영 목과 따로 둔다)
export const captureReportHandlers = [
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
      if (review.pending + review.confirmed + review.dismissed === 0) return;
      const open = review.completedAt === null;
      if ((status === "PENDING") !== open) return;
      items.push({
        checkpointId: inspection.checkpointId,
        rentalId: rentalOfCheckpoint(inspection.checkpointId) ?? "",
        captureSetId: `set-${inspection.checkpointId}`.slice(0, 21),
        source: "BOOTH",
        profile: (inspection.photoDefects ?? []).length > 0 ? "QUICK" : "FULL",
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
    const kept = candidates(inspection).filter((d) => d.review?.status !== "DISMISSED" && d.class !== "stain");
    inspection.grade = kept.some((d) => d.class === "dent" || d.class === "crack") ? "C" : kept.length > 0 ? "B" : "A";
    inspection.ruleVersion = "grade-rules-v1";
    inspection.reasons = [`사람 검수: 흠집 맞음 ${review.confirmed} · 흠집 아님 ${review.dismissed}`];
    inspection.review = { ...review, completedAt: new Date().toISOString() };
    return HttpResponse.json(inspection);
  }),
];

function adminDenied(request: Request) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "관리자만 검수할 수 있습니다");
  return null;
}

type Candidate = { defectId: string; class: string; modelVersion: string; review?: DefectReview };

/** 검수 후보: review가 있는 흠집(검수 이전 결과는 후보 없음) */
function candidates(inspection: Inspection): Candidate[] {
  const list: Candidate[] = [...(inspection.photoDefects ?? []), ...inspection.defects];
  return list.filter((d) => d.review !== undefined);
}

function summaryOf(inspection: Inspection): InspectionReview {
  const list = candidates(inspection);
  const count = (s: DefectReview["status"]) => list.filter((d) => d.review?.status === s).length;
  return { pending: count("PENDING"), confirmed: count("CONFIRMED"), dismissed: count("DISMISSED"), completedAt: inspection.review?.completedAt ?? null };
}

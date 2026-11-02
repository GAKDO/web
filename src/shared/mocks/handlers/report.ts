import { http, HttpResponse } from "msw";
import { accountFromRequest, db } from "../db";
import { problem } from "./problem";

// WE3 리포트 목: report-server 타임라인, 고객 화면이 읽는 기종 치수. 권한은 계약 x-trace-access(OWN_RENTAL)를 흉내 낸다

/** 렌탈을 볼 수 있는지. 관리자는 모두, 고객은 자기 렌탈만 */
export function rentalDenied(request: Request, rentalId: string | undefined) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (!rentalId || !db.rentals.some((r) => r.rentalId === rentalId)) return problem(404, "NOT_FOUND", "렌탈이 없습니다");
  if (account.role !== "ADMIN" && db.report.owners.get(rentalId) !== account.accountId) {
    return problem(403, "OUT_OF_SCOPE", "이 렌탈을 볼 권한이 없습니다");
  }
  return null;
}

/** 시점 ID → 렌탈 ID */
export function rentalOfCheckpoint(checkpointId: string): string | undefined {
  return db.rentals.find((r) => r.checkpoints.some((c) => c.checkpointId === checkpointId))?.rentalId;
}

export const reportHandlers = [
  http.get("*/api/v1/reports/rentals/:rentalId", ({ request, params }) => {
    const rentalId = String(params.rentalId);
    const no = rentalDenied(request, rentalId);
    if (no) return no;
    const timeline = db.report.timelines.get(rentalId);
    return timeline ? HttpResponse.json(timeline) : problem(404, "NOT_FOUND", "리포트가 없습니다");
  }),

  http.get("*/api/v1/device-models/:modelCode", ({ request, params }) => {
    if (!accountFromRequest(request)) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    const model = db.models.find((m) => m.modelCode === params.modelCode);
    return model ? HttpResponse.json(model) : problem(404, "NOT_FOUND", "기종이 없습니다");
  }),
];

import { http, HttpResponse } from "msw";
import { db } from "../db";
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
];

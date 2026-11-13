import { http, HttpResponse } from "msw";
import { accountFromRequest, db } from "../db";
import { problem } from "./problem";
import { rentalDenied, rentalOfCheckpoint } from "./report";

// WE3 비교표가 읽는 diagnostics-server 시점 진단 목
export const diagnosticsHandlers = [
  http.get("*/api/v1/diagnostics/checkpoints/:checkpointId", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const diag = db.report.diagnostics.get(checkpointId);
    return diag ? HttpResponse.json(diag) : problem(404, "NOT_FOUND", "진단 기록이 없습니다");
  }),
  // 진단 다시 하기(11/13): 관리자만, 봉인된 시점은 409, 진단이 없으면 404. 목은 이전 진단을 따로 두지 않는다
  http.post("*/api/v1/diagnostics/checkpoints/:checkpointId/redo", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const account = accountFromRequest(request);
    if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "권한이 없습니다");
    const checkpoint = db.rentals.flatMap((r) => r.checkpoints).find((c) => c.checkpointId === checkpointId);
    if (checkpoint?.status === "SEALED") return problem(409, "RECORD_ALREADY_SEALED", "이미 봉인된 시점입니다");
    const diag = db.report.diagnostics.get(checkpointId);
    if (!diag) return problem(404, "NOT_FOUND", "진단 기록이 없습니다");
    db.report.diagnostics.delete(checkpointId);
    return HttpResponse.json({ checkpointId, supersededRunId: diag.current.runId, supersededAt: new Date().toISOString() });
  }),
];

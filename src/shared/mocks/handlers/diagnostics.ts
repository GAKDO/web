import { http, HttpResponse } from "msw";
import { db } from "../db";
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
];

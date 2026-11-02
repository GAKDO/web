import { http, HttpResponse } from "msw";
import type { VerifyResponse } from "../../api/types";
import { problem } from "./problem";

// 공개 검증 목(RP1 전). 계약 report-server.yaml verifyRecord를 따른다. 토큰으로 경우를 고른다
export const VERIFY_TOKENS = {
  valid: "0123456789abcdef0123456789abcdef",
  tampered: "fedcba9876543210fedcba9876543210",
  serverError: "5005005005005005005005005005005a",
} as const;

const records: VerifyResponse["records"] = [
  // 일부러 seq를 섞어 둔다. 화면이 seq 순서로 다시 놓는지 본다
  { seq: 2, checkpointType: "RCV", grade: null, payloadHash: "c41d2b6f8a0c3e5d7f9b1a3c5e7d9f0b2a4c6e8d0f1b3a5c7e9d1f2b4a6c9a07", signedAt: "2026-11-12T04:10:00Z" },
  { seq: 1, checkpointType: "OUT", grade: "A", payloadHash: "7f3a0c1e5b9d2f4a6c8e0b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7de21b", signedAt: "2026-11-12T00:00:00Z" },
];

function body(valid: boolean): VerifyResponse {
  return { valid, modelName: "MacBook Air (M2, 2022)", records, checkedAt: new Date().toISOString() };
}

export const verifyHandlers = [
  http.get("*/api/v1/verify/:verifyToken", ({ params }) => {
    const token = String(params.verifyToken);
    if (token === VERIFY_TOKENS.valid) return HttpResponse.json(body(true));
    if (token === VERIFY_TOKENS.tampered) return HttpResponse.json(body(false));
    if (token === VERIFY_TOKENS.serverError) return problem(500, "INTERNAL_ERROR", "서버 오류");
    return problem(404, "NOT_FOUND", "검증 기록이 없습니다");
  }),
];

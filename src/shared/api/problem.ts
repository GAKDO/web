import type { CaptureFace, ErrorCode } from "./types";

/** 화면이 다루는 오류 하나. status 0은 서버에 닿지 못한 경우 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | null,
    readonly detail: string | null,
    /** 409 CAPTURE_FACES_MISSING일 때 빠진 면 */
    readonly missingFaces: CaptureFace[] = [],
    /** 400 CODE_INVALID일 때 남은 시도 횟수 */
    readonly remainingAttempts: number | null = null,
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Problem Details 본문(또는 알 수 없는 본문)을 ApiError로 바꾼다 */
export function toApiError(status: number, body: unknown): ApiError {
  if (!isRecord(body)) return new ApiError(status, null, null);
  const code = typeof body.code === "string" ? (body.code as ErrorCode) : null;
  const detail = typeof body.detail === "string" ? body.detail : null;
  const missingFaces = Array.isArray(body.missingFaces) ? (body.missingFaces as CaptureFace[]) : [];
  const remainingAttempts = typeof body.remainingAttempts === "number" ? body.remainingAttempts : null;
  return new ApiError(status, code, detail, missingFaces, remainingAttempts);
}

export function networkError(): ApiError {
  return new ApiError(0, null, null);
}

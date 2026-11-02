import { HttpResponse } from "msw";
import type { ErrorCode, Problem } from "../../api/types";

export function problem(status: number, code: ErrorCode, title: string, detail?: string) {
  const body: Problem = { type: "about:blank", title, status, code, ...(detail ? { detail } : {}) };
  return HttpResponse.json(body, { status, headers: { "Content-Type": "application/problem+json" } });
}

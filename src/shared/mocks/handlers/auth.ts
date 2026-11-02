import { http, HttpResponse } from "msw";
import type { components } from "../../api/generated/auth";
import type { LoginRequest, TokenResponse } from "../../api/types";
import { accountFromRequest, db, issueAccessToken } from "../db";
import { problem } from "./problem";

const tokenBody = (accessToken: string, role: TokenResponse["role"]): TokenResponse => ({
  accessToken,
  tokenType: "Bearer",
  expiresIn: 900,
  role,
});

export const authHandlers = [
  http.post("*/api/v1/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as LoginRequest;
    const account = db.accounts.find((a) => a.email === email && a.password === password);
    if (!account) return problem(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않습니다");
    db.refreshAccount = account;
    return HttpResponse.json(tokenBody(issueAccessToken(account), account.role));
  }),
  http.post("*/api/v1/auth/refresh", () => {
    const account = db.refreshAccount;
    if (!account) return problem(401, "REFRESH_INVALID", "다시 로그인해 주세요");
    return HttpResponse.json(tokenBody(issueAccessToken(account), account.role));
  }),
  http.post("*/api/v1/auth/logout", () => {
    db.refreshAccount = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/v1/auth/me", ({ request }) => {
    const account = accountFromRequest(request);
    if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    const me = {
      accountId: account.accountId,
      email: account.email,
      name: account.role === "ADMIN" ? "관리자" : "고객",
      role: account.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
      status: "ACTIVE",
      rentalIds: [],
    } satisfies components["schemas"]["MeResponse"];
    return HttpResponse.json(me);
  }),
];

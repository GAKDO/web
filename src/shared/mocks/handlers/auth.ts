import { http, HttpResponse } from "msw";
import type { components } from "../../api/generated/auth";
import type { LoginRequest, TokenResponse } from "../../api/types";
import { accountFromRequest, db, issueAccessToken, MOCK_RESET_CODE } from "../db";
import { problem } from "./problem";

const RESET_ATTEMPTS = 3;

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
      rentalIds: [...db.report.owners].filter(([, owner]) => owner === account.accountId).map(([rentalId]) => rentalId),
    } satisfies components["schemas"]["MeResponse"];
    return HttpResponse.json(me);
  }),
  // 계정이 있는지 드러내지 않도록 늘 202. 있는 계정이면 코드를 새로 만든다
  http.post("*/api/v1/auth/password/reset-request", async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    if (db.accounts.some((a) => a.email === email)) db.resetCodes.set(email, { code: MOCK_RESET_CODE, remaining: RESET_ATTEMPTS });
    return new HttpResponse(null, { status: 202 });
  }),
  http.post("*/api/v1/auth/password/reset", async ({ request }) => {
    const { email, code, newPassword } = (await request.json()) as { email: string; code: string; newPassword: string };
    const entry = db.resetCodes.get(email);
    const account = db.accounts.find((a) => a.email === email);
    if (!entry || !account || entry.remaining === 0) return problem(410, "CODE_EXPIRED", "재설정 코드가 만료되었습니다");
    if (entry.code !== code) {
      entry.remaining -= 1;
      const response = { type: "about:blank", title: "재설정 코드가 맞지 않습니다", status: 400, code: "CODE_INVALID", remainingAttempts: entry.remaining };
      return HttpResponse.json(response, { status: 400, headers: { "Content-Type": "application/problem+json" } });
    }
    account.password = newPassword;
    db.resetCodes.delete(email);
    // 성공하면 그 계정의 리프레시 토큰을 모두 폐기한다
    if (db.refreshAccount === account) db.refreshAccount = null;
    return new HttpResponse(null, { status: 204 });
  }),
  http.delete("*/api/v1/auth/me", async ({ request }) => {
    const account = accountFromRequest(request);
    if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
    const { password } = (await request.json()) as { password: string };
    if (password !== account.password) return problem(401, "INVALID_CREDENTIALS", "비밀번호가 맞지 않습니다");
    db.accounts = db.accounts.filter((a) => a !== account);
    for (const [token, owner] of db.accessTokens) if (owner === account) db.accessTokens.delete(token);
    if (db.refreshAccount === account) db.refreshAccount = null;
    return new HttpResponse(null, { status: 204 });
  }),
];

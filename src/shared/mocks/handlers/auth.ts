import { http, HttpResponse } from "msw";
import type { components } from "../../api/generated/auth";
import { nanoid } from "nanoid";
import type { EmailVerifyRequest, LoginRequest, SignupRequest, TokenResponse } from "../../api/types";
import { MOCK_EMAIL_CODE, accountFromRequest, db, issueAccessToken } from "../db";
import { problem } from "./problem";

const tokenBody = (accessToken: string, role: TokenResponse["role"]): TokenResponse => ({
  accessToken,
  tokenType: "Bearer",
  expiresIn: 900,
  role,
});

export const authHandlers = [
  http.post("*/api/v1/auth/signup", async ({ request }) => {
    const body = (await request.json()) as SignupRequest;
    if (!body.privacyAgreed) return problem(400, "CONSENT_REQUIRED", "개인정보 수집에 동의해 주세요");
    if (db.accounts.some((a) => a.email === body.email)) return problem(409, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다");
    const account = { accountId: nanoid(), email: body.email, password: body.password, role: "CUSTOMER" as const, pending: true };
    db.accounts.push(account);
    return HttpResponse.json({ accountId: account.accountId, status: "PENDING" }, { status: 201 });
  }),
  http.post("*/api/v1/auth/email/verify", async ({ request }) => {
    const { email, code } = (await request.json()) as EmailVerifyRequest;
    const account = db.accounts.find((a) => a.email === email && a.pending);
    if (!account || code !== MOCK_EMAIL_CODE) return problem(400, "CODE_INVALID", "인증 코드가 맞지 않습니다");
    account.pending = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("*/api/v1/auth/email/resend", () => new HttpResponse(null, { status: 202 })),
  http.post("*/api/v1/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as LoginRequest;
    const account = db.accounts.find((a) => a.email === email && a.password === password);
    if (!account) return problem(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않습니다");
    if (account.pending) return problem(403, "EMAIL_NOT_VERIFIED", "이메일 인증 전입니다");
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
];

import { http, HttpResponse } from "msw";
import type { components } from "../../api/generated/auth";
import { nanoid } from "nanoid";
import type { EmailVerifyRequest, LoginRequest, SignupRequest, TokenResponse } from "../../api/types";
import { MOCK_EMAIL_CODE, MOCK_RESET_CODE, accountFromRequest, db, issueAccessToken } from "../db";
import { problem } from "./problem";

const RESET_ATTEMPTS = 3;

const tokenBody = (accessToken: string, role: TokenResponse["role"]): TokenResponse => ({
  accessToken,
  tokenType: "Bearer",
  expiresIn: 900,
  role,
});

export const authHandlers = [
  // 소셜 로그인: 목에서는 키가 설정된 제공자가 없다(테스트가 server.use로 바꿔 끼운다)
  http.get("*/api/v1/auth/oauth/providers", () => HttpResponse.json({ providers: [] })),
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
    if (!account) return problem(400, "CODE_INVALID", "인증 코드가 맞지 않습니다");
    // 5번 틀린 코드는 다시 받을 때까지 맞아도 받지 않는다(auth-server: 폐기)
    if ((account.verifyMisses ?? 0) >= 5) return problem(410, "CODE_EXPIRED", "인증 코드가 만료되었습니다");
    if (code !== MOCK_EMAIL_CODE) {
      // auth-server(AU2)처럼 틀릴 때마다 남은 시도 횟수를 싣는다(5번 틀리면 폐기)
      account.verifyMisses = (account.verifyMisses ?? 0) + 1;
      const response = { type: "about:blank", title: "인증 코드가 맞지 않습니다", status: 400, code: "CODE_INVALID", remainingAttempts: Math.max(0, 5 - account.verifyMisses) };
      return HttpResponse.json(response, { status: 400, headers: { "Content-Type": "application/problem+json" } });
    }
    account.pending = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("*/api/v1/auth/email/resend", async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    // 새 코드를 보내면 틀린 횟수도 새로 센다
    const account = db.accounts.find((a) => a.email === email && a.pending);
    if (account) account.verifyMisses = 0;
    return new HttpResponse(null, { status: 202 });
  }),
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

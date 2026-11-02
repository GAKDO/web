import { http, HttpResponse } from "msw";
import { api, refreshSession, refreshSessionOutcome, setSessionExpiredHandler, unwrap } from "./client";
import { ApiError } from "./problem";
import { tokenStore } from "../auth/tokenStore";
import { server } from "../mocks/node";
import { MOCK_ADMIN, db, expireAccessTokens } from "../mocks/db";

async function login() {
  const token = await unwrap(api.POST("/api/v1/auth/login", { body: { ...MOCK_ADMIN } }));
  tokenStore.set(token);
}

test("요청이 401로 실패하면 한 번만 토큰을 다시 받아 같은 요청을 다시 보낸다", async () => {
  await login();
  const before = tokenStore.get()?.accessToken;
  expireAccessTokens();
  const me = await unwrap(api.GET("/api/v1/auth/me"));
  expect(me.email).toBe(MOCK_ADMIN.email);
  expect(tokenStore.get()?.accessToken).not.toBe(before);
});

test("동시에 여러 요청이 401이 나도 다시 받기는 한 번만 한다", async () => {
  await login();
  expireAccessTokens();
  let refreshCalls = 0;
  server.events.on("request:start", ({ request }) => {
    if (request.url.endsWith("/api/v1/auth/refresh")) refreshCalls += 1;
  });
  await Promise.all([1, 2, 3].map(() => unwrap(api.GET("/api/v1/auth/me"))));
  server.events.removeAllListeners();
  expect(refreshCalls).toBe(1);
});

test("다시 받기도 실패하면 세션을 비우고 로그인 화면으로 보낼 함수를 부른다", async () => {
  await login();
  expireAccessTokens();
  db.refreshAccount = null;
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toBeInstanceOf(ApiError);
  expect(tokenStore.get()).toBeNull();
  expect(expired).toHaveBeenCalledOnce();
});

test("리프레시 쿠키가 없으면 refreshSession은 false다", async () => {
  expect(await refreshSession()).toBe(false);
});

test("서버에 닿지 못하면 status 0 오류를 던진다", async () => {
  server.use(http.get("*/api/v1/auth/me", () => Response.error()));
  await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 0 });
});

test("토큰 다시 받기를 기다리는 동안 다른 계정으로 로그인하면 늦게 온 이전 토큰으로 덮어쓰지 않는다", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post("*/api/v1/auth/refresh", async () => {
      await gate;
      return Response.json({ accessToken: "old-account", tokenType: "Bearer", expiresIn: 60, role: "CUSTOMER" });
    }),
  );
  const pending = refreshSession();
  tokenStore.set({ accessToken: "new-account", tokenType: "Bearer", expiresIn: 60, role: "ADMIN" } as never);
  release();
  expect(await pending).toBe(true);
  expect(tokenStore.get()?.accessToken).toBe("new-account");
});

test("토큰 다시 받기가 네트워크 오류로 끝나도, 그사이 새로 로그인했으면 새 세션을 유지한다", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post("*/api/v1/auth/refresh", async () => {
      await gate;
      return Response.error();
    }),
  );
  const pending = refreshSession();
  tokenStore.set({ accessToken: "new-account", tokenType: "Bearer", expiresIn: 60, role: "ADMIN" } as never);
  release();
  expect(await pending).toBe(true);
  expect(tokenStore.get()?.accessToken).toBe("new-account");
});

test("리프레시가 네트워크 오류·5xx면 transient, 거절이면 rejected로 나눈다", async () => {
  server.use(http.post("*/api/v1/auth/refresh", () => HttpResponse.error()));
  expect(await refreshSessionOutcome()).toBe("transient");
  server.use(http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 503 })));
  expect(await refreshSessionOutcome()).toBe("transient");
  server.use(http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })));
  expect(await refreshSessionOutcome()).toBe("rejected");
});

test("토큰 다시 받기와 로그아웃 요청은 리프레시 쿠키를 보내도록 credentials: include로 나간다", async () => {
  await login();
  const seen: Record<string, RequestCredentials> = {};
  server.events.on("request:start", ({ request }) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/auth/refresh") || path.endsWith("/auth/logout")) seen[path] = request.credentials;
  });
  await refreshSession();
  await api.POST("/api/v1/auth/logout");
  server.events.removeAllListeners();
  expect(seen).toEqual({ "/api/v1/auth/refresh": "include", "/api/v1/auth/logout": "include" });
});

test("입력한 비밀번호가 틀린 401(INVALID_CREDENTIALS)은 토큰이 만료돼 다시 받은 뒤라도 세션을 끝내지 않는다", async () => {
  await login();
  expireAccessTokens();
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  const error = await unwrap(api.DELETE("/api/v1/auth/me", { body: { password: "wrong-pass" } })).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe("INVALID_CREDENTIALS");
  expect(expired).not.toHaveBeenCalled();
  expect(tokenStore.get()).not.toBeNull();
});

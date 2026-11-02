import { http } from "msw";
import { api, refreshSession, setSessionExpiredHandler, unwrap } from "./client";
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

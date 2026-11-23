// 이 파일이 확인하는 것: 모든 화면이 서버를 부를 때 쓰는 공통 통로(API 클라이언트)의 로그인 유지 규칙.
// 짧게 사는 출입증(액세스 토큰)이 만료되면 길게 사는 리프레시 쿠키로 새 출입증을 받아 요청을 다시 보내고,
// 그것도 안 되면 로그아웃시킨다. 여러 요청·여러 탭·계정 바꾸기가 겹쳐도 엉키지 않는지 본다.

import { http, HttpResponse } from "msw";
import { api, refreshSession, refreshSessionOutcome, setSessionExpiredHandler, unwrap, withRefreshExclusive } from "./client";
import { ApiError } from "./problem";
import { tokenStore } from "../auth/tokenStore";
import { server } from "../mocks/node";
import { MOCK_ADMIN, db, expireAccessTokens } from "../mocks/db";

// 테스트 도구: 관리자 계정으로 로그인해 출입증을 화면 메모리에 넣는다.
async function login() {
  const token = await unwrap(api.POST("/api/v1/auth/login", { body: { ...MOCK_ADMIN } }));
  tokenStore.set(token);
}

// [상황] 로그인 뒤 출입증이 만료된 상태에서 "내 정보"를 요청한다.
// [기대] 401을 받으면 새 출입증을 한 번 받아 같은 요청을 다시 보내 성공하고, 출입증이 새것으로 바뀐다.
//        ※ 응답 코드: 401 = 로그인 필요(토큰이 없거나 만료·위조됨)
test("요청이 401로 실패하면 한 번만 토큰을 다시 받아 같은 요청을 다시 보낸다", async () => {
  await login();
  const before = tokenStore.get()?.accessToken;
  expireAccessTokens();
  const me = await unwrap(api.GET("/api/v1/auth/me"));
  expect(me.email).toBe(MOCK_ADMIN.email);
  expect(tokenStore.get()?.accessToken).not.toBe(before);
});

// [상황] 출입증이 만료된 상태에서 요청 3개를 동시에 보낸다.
// [기대] 새 출입증 받기는 딱 한 번만 한다(서버 부담과 쿠키 꼬임 방지).
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

// [상황] 출입증이 만료됐고 리프레시 쿠키도 만료됐다.
// [기대] 요청은 실패하고, 출입증을 지우며, "로그인 화면으로 보내기" 처리를 한 번 부른다.
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

// [상황] 출입증이 만료됐고, 새 출입증 받기에서 서버가 503(일시 장애)을 준다.
// [기대] 그 요청만 실패하고 로그아웃시키지 않는다(서버가 잠깐 아픈 것 때문에 쫓아내지 않음).
//        ※ 응답 코드: 503 = 서버를 지금 쓸 수 없음(점검·장애)
test("다시 받기가 네트워크 오류·5xx면 세션을 끝내지 않고 그 요청만 실패시킨다", async () => {
  await login();
  expireAccessTokens();
  server.use(http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 503 })));
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 401 });
  expect(tokenStore.get()).not.toBeNull();
  expect(expired).not.toHaveBeenCalled();
});

// [상황] 리프레시 쿠키 없이 새 출입증 받기를 시도한다.
// [기대] 실패(false)로 끝난다.
test("리프레시 쿠키가 없으면 refreshSession은 false다", async () => {
  expect(await refreshSession()).toBe(false);
});

// [상황] 네트워크 오류로 서버에 아예 닿지 못한다.
// [기대] 상태 번호 0인 오류를 낸다(화면이 "서버에 닿지 못함"으로 구분해 보이게).
test("서버에 닿지 못하면 status 0 오류를 던진다", async () => {
  server.use(http.get("*/api/v1/auth/me", () => Response.error()));
  await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 0 });
});

// [상황] 이전 계정의 새 출입증 받기가 늦게 오는 사이, 다른 계정으로 새로 로그인했다.
// [기대] 늦게 온 이전 계정 출입증으로 덮어쓰지 않고 새 계정 출입증이 남는다(남의 계정으로 바뀌는 사고 방지).
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

// [상황] 새 출입증 받기가 네트워크 오류로 끝나는 사이 새로 로그인했다.
// [기대] 새로 로그인한 세션을 그대로 유지한다.
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

// [상황] 새 출입증 받기 결과가 네트워크 오류, 503, 401인 경우를 차례로 본다.
// [기대] 네트워크 오류·503은 "일시 문제(transient)", 401은 "거절(rejected)"로 나눈다(일시 문제면 로그아웃하지 않음).
//        ※ 응답 코드: 503 = 서버를 지금 쓸 수 없음(점검·장애), 401 = 로그인 필요(토큰이 없거나 만료·위조됨)
test("리프레시가 네트워크 오류·5xx면 transient, 거절이면 rejected로 나눈다", async () => {
  server.use(http.post("*/api/v1/auth/refresh", () => HttpResponse.error()));
  expect(await refreshSessionOutcome()).toBe("transient");
  server.use(http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 503 })));
  expect(await refreshSessionOutcome()).toBe("transient");
  server.use(http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })));
  expect(await refreshSessionOutcome()).toBe("rejected");
});

// [상황] 새 출입증 받기와 로그아웃을 요청한다.
// [기대] 두 요청 모두 리프레시 쿠키를 함께 보내도록 설정(credentials: include)돼 나간다.
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

// [상황] 출입증이 만료된 상태에서 탈퇴하려고 틀린 비밀번호를 넣는다(새 출입증을 받은 뒤 서버가 "비밀번호 틀림" 401을 줌).
// [기대] 비밀번호 틀림 오류만 돌려주고 로그아웃시키지 않는다(출입증 만료 401과 구분).
//        ※ 응답 코드: 401 = 로그인 필요(토큰이 없거나 만료·위조됨)
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

// [상황] 브라우저 탭 사이 잠금 기능이 있는 환경에서, 같은 탭에서 새 출입증 받기를 동시에 두 번 부른다.
// [기대] 요청은 하나로 합쳐지고, 그 요청은 "trace-auth-refresh" 잠금 안에서 겹치지 않게 보낸다(여러 탭이 동시에 쿠키를 바꾸지 않게).
test("브라우저가 잠금(Web Locks)을 지원하면 리프레시를 탭 사이 잠금 안에서 한 번에 하나씩 보낸다", async () => {
  await login();
  const names: string[] = [];
  let held = false;
  let overlapped = false;
  let queue: Promise<unknown> = Promise.resolve();
  const locks = {
    request: (name: string, callback: () => Promise<unknown>) => {
      names.push(name);
      const run = queue.then(async () => {
        if (held) overlapped = true;
        held = true;
        try {
          return await callback();
        } finally {
          held = false;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
  try {
    // 같은 탭 안의 동시 호출은 요청 하나로 합쳐지고, 그 요청이 잠금을 거친다
    const results = await Promise.all([refreshSession(), refreshSession()]);
    expect(results).toEqual([true, true]);
    expect(names).toEqual(["trace-auth-refresh"]);
    expect(overlapped).toBe(false);
  } finally {
    Reflect.deleteProperty(navigator, "locks");
  }
});

// [상황] 새 출입증 받기가 진행 중일 때 로그인 요청을 한다.
// [기대] 로그인은 출입증 받기가 끝난 뒤에 보낸다(이전 계정의 늦은 쿠키가 새 로그인 쿠키를 덮어쓰지 않게).
test("로그인 요청은 진행 중인 리프레시가 끝난 뒤에 보낸다(이전 계정의 늦은 쿠키가 새 쿠키를 덮어쓰지 않게)", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post("*/api/v1/auth/refresh", async () => {
      await gate;
      return new HttpResponse(null, { status: 401 });
    }),
  );
  const order: string[] = [];
  const pending = refreshSession().then(() => order.push("refresh"));
  const login = withRefreshExclusive(async () => {
    order.push("login");
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(order).toEqual([]);
  release();
  await Promise.all([pending, login]);
  expect(order).toEqual(["refresh", "login"]);
});

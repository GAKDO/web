// 이 파일이 확인하는 것: 리포트의 실시간 진행률 연결(openProgressStream)이 끊기거나 거절될 때의 행동.
// 다시 붙어도 소용없으면 멈추고, 출입증(토큰)이 만료됐으면 한 번 다시 받아 보고, 일시적인 네트워크 문제면 잠시 뒤 다시 붙는다.

import { http, HttpResponse } from "msw";
import { setSessionExpiredHandler } from "./client";
import { openProgressStream, StreamFatal } from "./stream";
import { tokenStore } from "../auth/tokenStore";
import { server } from "../mocks/node";

// 테스트 도구: 진행 소식·완료·다시 연결 중·연결됨·포기 신호가 몇 번 왔는지 세는 가짜 받는 쪽.
const handlers = () => ({ onProgress: vi.fn(), onDone: vi.fn(), onReconnecting: vi.fn(), onConnected: vi.fn(), onFatal: vi.fn() });

// 테스트 도구: 진행률 연결 요청이 서버로 몇 번 갔는지 센다.
function countStreamRequests(): { count: number } {
  const seen = { count: 0 };
  server.events.on("request:start", ({ request }) => {
    if (request.url.endsWith("/stream")) seen.count += 1;
  });
  return seen;
}

// 테스트 도구: 요청 세기를 끄고, "로그인 만료" 처리를 기본값으로 되돌린다.
afterEach(() => {
  server.events.removeAllListeners();
  setSessionExpiredHandler(() => {});
});

// [상황] 서버가 진행률 연결을 403(권한 없음)으로 거절한다.
// [기대] 한 번만 요청하고 다시 붙으려 하지 않으며, 포기 신호를 한 번 보낸다.
test("403처럼 다시 붙어도 소용없는 응답이면 한 번만 요청하고 멈춘다", async () => {
  server.use(http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 403 })));
  const seen = countStreamRequests();
  const h = handlers();
  await expect(openProgressStream("r1", h, new AbortController().signal)).rejects.toBeInstanceOf(StreamFatal);
  expect(seen.count).toBe(1);
  expect(h.onReconnecting).not.toHaveBeenCalledWith(true);
  expect(h.onFatal).toHaveBeenCalledTimes(1);
});

// [상황] 진행률 연결이 401(출입증 만료)이고, 새 출입증 받기도 실패한다.
// [기대] 한 번만 연결하고 멈추며, 로그인 만료 처리를 한 번 부르고 출입증을 지운다.
test("401에서 토큰을 다시 받지 못하면 세션 만료로 처리하고 멈춘다", async () => {
  tokenStore.set({ accessToken: "old", tokenType: "Bearer", expiresIn: 60 } as never);
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => new HttpResponse(null, { status: 401 })),
  );
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  const seen = countStreamRequests();
  await expect(openProgressStream("r1", handlers(), new AbortController().signal)).rejects.toBeInstanceOf(StreamFatal);
  expect(seen.count).toBe(1);
  expect(expired).toHaveBeenCalledTimes(1);
  expect(tokenStore.get()).toBeNull();
});

// [상황] 401을 받아 새 출입증을 받았는데, 다시 연결해도 또 401이다.
// [기대] 두 번째 연결에서 멈추고 로그인 만료 처리를 한다(끝없이 반복하지 않음).
test("토큰을 다시 받은 뒤에도 401이면 두 번째에서 멈춘다", async () => {
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => HttpResponse.json({ accessToken: "new", tokenType: "Bearer", expiresIn: 60 })),
  );
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  const seen = countStreamRequests();
  await expect(openProgressStream("r1", handlers(), new AbortController().signal)).rejects.toBeInstanceOf(StreamFatal);
  expect(seen.count).toBe(2);
  expect(expired).toHaveBeenCalledTimes(1);
}, 10_000);

// [상황] 출입증을 다시 받는 사이에 고객이 화면을 떠났고(연결 취소), 그 뒤 다시 받기가 실패한다.
// [기대] 로그인 만료로 처리하지 않고 기존 출입증을 그대로 둔다(떠난 화면 때문에 로그아웃되지 않게).
test("화면을 떠난 뒤 토큰 다시 받기가 실패해도 세션을 만료시키지 않는다", async () => {
  tokenStore.set({ accessToken: "old", tokenType: "Bearer", expiresIn: 60 } as never);
  const controller = new AbortController();
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => {
      controller.abort();
      return new HttpResponse(null, { status: 401 });
    }),
  );
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  await openProgressStream("r1", handlers(), controller.signal).catch(() => undefined);
  expect(expired).not.toHaveBeenCalled();
  expect(tokenStore.get()?.accessToken).toBe("old");
  tokenStore.clear();
});

// [상황] 첫 연결은 바로 끊기고, 다시 붙은 두 번째 연결은 유지된다.
// [기대] 붙을 때마다 "연결됨" 신호가 와서 모두 두 번 불린다(붙을 때마다 리포트를 다시 읽는 데 쓰임).
test("붙을 때마다(첫 연결과 끊긴 뒤 다시 붙을 때) onConnected를 부른다", async () => {
  let calls = 0;
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => {
      calls += 1;
      // 첫 연결은 바로 끊고, 두 번째는 열어 둔다
      const body = new ReadableStream<Uint8Array>({ start: (c) => (calls === 1 ? c.close() : undefined) });
      return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
    }),
  );
  const h = handlers();
  const controller = new AbortController();
  void openProgressStream("r1", h, controller.signal).catch(() => undefined);
  await vi.waitFor(() => expect(h.onConnected).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(h.onConnected).toHaveBeenCalledTimes(2), { timeout: 4000 });
  controller.abort();
}, 10_000);

// [상황] 401을 받아 출입증을 다시 받으려는데, 네트워크 오류로 실패한다.
// [기대] 로그인 만료로 처리하지 않고 기존 출입증을 둔 채, "다시 연결 중"을 알리고 잠시 뒤 다시 붙는다.
test("토큰 다시 받기가 네트워크 오류로 실패하면 세션을 두고 잠시 뒤 다시 붙는다", async () => {
  tokenStore.set({ accessToken: "old", tokenType: "Bearer", expiresIn: 60 } as never);
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 401 })),
    http.post("*/api/v1/auth/refresh", () => HttpResponse.error()),
  );
  const expired = vi.fn();
  setSessionExpiredHandler(expired);
  const seen = countStreamRequests();
  const h = handlers();
  const controller = new AbortController();
  void openProgressStream("r1", h, controller.signal);
  await vi.waitFor(() => expect(seen.count).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
  controller.abort();
  expect(expired).not.toHaveBeenCalled();
  expect(h.onFatal).not.toHaveBeenCalled();
  expect(h.onReconnecting).toHaveBeenCalledWith(true);
  expect(tokenStore.get()?.accessToken).toBe("old");
  tokenStore.clear();
}, 10_000);

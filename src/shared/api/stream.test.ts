import { http, HttpResponse } from "msw";
import { setSessionExpiredHandler } from "./client";
import { openProgressStream, StreamFatal } from "./stream";
import { tokenStore } from "../auth/tokenStore";
import { server } from "../mocks/node";

const handlers = () => ({ onProgress: vi.fn(), onDone: vi.fn(), onReconnecting: vi.fn(), onConnected: vi.fn(), onFatal: vi.fn() });

function countStreamRequests(): { count: number } {
  const seen = { count: 0 };
  server.events.on("request:start", ({ request }) => {
    if (request.url.endsWith("/stream")) seen.count += 1;
  });
  return seen;
}

afterEach(() => {
  server.events.removeAllListeners();
  setSessionExpiredHandler(() => {});
});

test("403처럼 다시 붙어도 소용없는 응답이면 한 번만 요청하고 멈춘다", async () => {
  server.use(http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 403 })));
  const seen = countStreamRequests();
  const h = handlers();
  await expect(openProgressStream("r1", h, new AbortController().signal)).rejects.toBeInstanceOf(StreamFatal);
  expect(seen.count).toBe(1);
  expect(h.onReconnecting).not.toHaveBeenCalledWith(true);
  expect(h.onFatal).toHaveBeenCalledTimes(1);
});

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

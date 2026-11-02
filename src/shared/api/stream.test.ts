import { http, HttpResponse } from "msw";
import { setSessionExpiredHandler } from "./client";
import { openProgressStream, StreamFatal } from "./stream";
import { tokenStore } from "../auth/tokenStore";
import { server } from "../mocks/node";

const handlers = () => ({ onProgress: vi.fn(), onDone: vi.fn(), onReconnecting: vi.fn() });

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

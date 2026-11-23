// 이 파일이 확인하는 것: 리포트 화면의 실시간 진행률(검사 진행 알림, SSE 스트림) 연결.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "../../../shared/mocks/node";
import { useProgress } from "./progress";

// [상황] 권한이 없는 렌탈(403)의 진행률을 보다가 다른 렌탈로 바꾼다.
// [기대] 앞 렌탈의 "연결 실패" 상태가 새 렌탈에 남지 않는다.
test("다른 렌탈로 바뀌면 이전 렌탈의 진행률 실패 상태를 넘기지 않는다", async () => {
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", ({ params }) =>
      params.rentalId === "denied"
        ? new HttpResponse(null, { status: 403 })
        : new HttpResponse(new ReadableStream<Uint8Array>(), { headers: { "Content-Type": "text/event-stream" } }),
    ),
  );
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender, unmount } = renderHook(({ id }) => useProgress(id, true), { wrapper, initialProps: { id: "denied" } });
  await waitFor(() => expect(result.current.failed).toBe(true));
  rerender({ id: "allowed" });
  await waitFor(() => expect(result.current.failed).toBe(false));
  unmount();
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "../../../shared/mocks/node";
import { useProgress } from "./progress";

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

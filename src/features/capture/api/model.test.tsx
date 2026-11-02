import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "../../../shared/mocks/node";
import { PHONE_FACES } from "../faces";
import { useFaceGuides } from "./model";

test("치수가 제한 시간 뒤에 오면 기본 윤곽을 그대로 유지한다(찍는 도중 윤곽이 바뀌지 않음)", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let modelServed = false;
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId", async () => {
      await gate;
      return HttpResponse.json({ rentalId: "r", modelCode: "SQUARE", chainStatus: "VALID", verifyUrl: "https://x", checkpoints: [] });
    }),
    http.get("*/api/v1/device-models/:modelCode", () => {
      modelServed = true;
      return HttpResponse.json({
        modelCode: "SQUARE",
        name: "정사각형",
        manufacturer: "테스트",
        formFactor: "CLAMSHELL",
        spec: null,
        dimensions: { widthMm: 200, depthMm: 200, baseHMm: 10, lidHMm: 5 },
        updatedAt: "2026-11-02T00:00:00+09:00",
      });
    }),
  );
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useFaceGuides("r", 30), { wrapper });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.faces).toBe(PHONE_FACES);
  release();
  await waitFor(() => expect(modelServed).toBe(true));
  await new Promise((r) => setTimeout(r, 20));
  expect(result.current.faces).toBe(PHONE_FACES);
});

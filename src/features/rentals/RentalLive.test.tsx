import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";
import type { Rental } from "../../shared/api/types";
import { RENTAL_ACTIVE_MS, RENTAL_IDLE_MS, rentalPollMs } from "./api/rentals";
import { LIVE_MAX_RETRIES } from "./api/useRentalLive";

const base = (checkpoints: Rental["checkpoints"], status: Rental["status"] = "OPEN") =>
  ({ rentalId: "r", deviceId: "d", renterRef: "R", status, startedAt: null, endedAt: null, createdAt: "2026-11-06T00:00:00Z", checkpoints }) as Rental;
const cp = (type: "OUT" | "RCV" | "RET", status: "OPEN" | "CAPTURED" | "GRADED" | "SEALED") =>
  ({ checkpointId: nanoid(), type, status, openedAt: "2026-11-06T00:00:00Z", sealedAt: null }) as unknown as Rental["checkpoints"][number];

test("봉인 전 시점이 있으면 3초, 모두 봉인됐어도 진행 중이면 10초마다 다시 읽고, 종료된 렌탈은 멈춘다", () => {
  expect(rentalPollMs(base([cp("OUT", "CAPTURED")]))).toBe(RENTAL_ACTIVE_MS);
  // 출고가 봉인된 뒤에도 부스 빠른 검사가 수령 시점을 열 수 있으므로 계속 본다
  expect(rentalPollMs(base([cp("OUT", "SEALED")]))).toBe(RENTAL_IDLE_MS);
  expect(rentalPollMs(base([cp("OUT", "SEALED"), cp("RCV", "SEALED"), cp("RET", "SEALED")], "CLOSED"))).toBe(false);
  expect(rentalPollMs(undefined)).toBe(false);
});

function pushRental(): string {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3001", status: "OPEN", startedAt: null, endedAt: null, createdAt: new Date().toISOString(), checkpoints: [] });
  return rentalId;
}

test("진행 중 렌탈 상세는 검사 진행 SSE에 붙어 '실시간 반영 중'을 보인다", async () => {
  renderAsAdmin(`/admin/rentals/${pushRental()}`);
  expect(await screen.findByText("실시간 반영 중")).toBeInTheDocument();
});

test("report-server가 없으면(404) SSE를 접고 '자동으로 다시 읽는 중'으로 바뀐다", async () => {
  server.use(http.get("*/api/v1/reports/rentals/:rentalId/stream", () => problem(404, "NOT_FOUND", "없음")));
  renderAsAdmin(`/admin/rentals/${pushRental()}`);
  await waitFor(() => expect(screen.getByText("자동으로 다시 읽는 중")).toBeInTheDocument());
});

test("report-server가 5번 연달아 5xx면 SSE를 접고 더는 다시 붙지 않는다", async () => {
  let calls = 0;
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => {
      calls += 1;
      return problem(503, "INTERNAL_ERROR", "잠시 뒤");
    }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    renderAsAdmin(`/admin/rentals/${pushRental()}`);
    for (let i = 0; i < 8; i += 1) await vi.advanceTimersByTimeAsync(2_100);
    await waitFor(() => expect(screen.getByText("자동으로 다시 읽는 중")).toBeInTheDocument());
    const after = calls;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(after);
    expect(calls).toBeLessThanOrEqual(LIVE_MAX_RETRIES + 1);
  } finally {
    vi.useRealTimers();
  }
});

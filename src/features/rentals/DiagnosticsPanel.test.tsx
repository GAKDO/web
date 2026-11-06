import { screen, within } from "@testing-library/react";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint, CheckpointDiagnostics } from "../../shared/api/types";
import { db } from "../../shared/mocks/db";

const now = new Date().toISOString();

function openRental(status: Checkpoint["status"]) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoint: Checkpoint = { checkpointId: nanoid(), type: "OUT", status, occurredAt: now };
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3201", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints: [checkpoint] });
  return { rentalId, checkpointId: checkpoint.checkpointId };
}

function diagnostics(checkpointId: string): CheckpointDiagnostics {
  return {
    checkpointId,
    current: {
      runId: nanoid(),
      collectedAt: "2026-11-06T14:03:22+09:00",
      os: "MACOS",
      battery: { cycleCount: 37, designCapacity: 4382, fullChargeCapacity: 4100, capacityUnit: "mAh", maxCapacityPct: 93.6, condition: "NORMAL", skippedReason: null },
      ssd: { percentUsed: 2, availableSparePct: 100, criticalWarning: 0, powerOnHours: 120, mediaErrors: 0, skippedReason: null },
      components: [{ kind: "CPU", identifier: "Apple M2" }],
      benchmarks: [],
    },
    previous: null,
    flags: [],
  };
}

test("진단이 아직 없으면 렌탈 상세 시점 칸에 '아직 올라온 진단이 없습니다'가 보인다", async () => {
  const { rentalId } = openRental("OPEN");
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByText(/아직 올라온 진단이 없습니다/)).toBeInTheDocument();
});

test("에이전트가 올린 진단이 있으면 배터리·충전 횟수·SSD·점검 알림이 렌탈 상세에 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(panel).toHaveTextContent("93.6%");
  expect(panel).toHaveTextContent("37회");
  expect(panel).toHaveTextContent("사용률 2%");
  expect(panel).toHaveTextContent("없음");
});

test("봉인된 시점도 올라온 진단은 그대로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("SEALED");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent("93.6%");
});

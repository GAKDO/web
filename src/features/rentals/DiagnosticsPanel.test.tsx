import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      benchmarks: [{ metric: "DISK_READ", median: 1482.6 }],
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
  expect(panel).toHaveTextContent("디스크 읽기 1,483 MB/s");
});

test("봉인된 시점도 올라온 진단은 그대로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("SEALED");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent("93.6%");
});

test("진단이 올라온 시점은 다 쓴 페어링 코드 버튼을 가린다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(step).queryByRole("button", { name: /페어링 코드/ })).not.toBeInTheDocument();
});

test("렌탈 상세의 진단 추이에 이 기기의 진단이 날짜 순 꺾은선으로 보이고, 시리얼은 드러나지 않는다", async () => {
  const pro = db.devices.find((d) => d.serial === "C02PRO0001")!;
  const rental = db.rentals.find((r) => r.deviceId === pro.deviceId && r.checkpoints.some((c) => db.report.diagnostics.has(c.checkpointId)))!;
  renderAsAdmin(`/admin/rentals/${rental.rentalId}`);
  await userEvent.click(await screen.findByRole("button", { name: "진단 추이 보기" }));
  const trend = await screen.findByRole("region", { name: "진단 추이" });
  const battery = await within(trend).findByRole("figure", { name: "배터리 최대 용량 추이" });
  // 출고 91.2% → 반납 84.0%: 마지막 값이 '최근'으로 보이고, 점마다 날짜·시점·값이 읽힌다
  expect(within(battery).getByText("최근 84.0%")).toBeInTheDocument();
  expect(within(battery).getAllByLabelText(/91\.2%/).length).toBeGreaterThan(0);
  // SSD는 권한이 없어 한 번도 못 읽었으므로 그래프가 없다
  expect(within(trend).queryByRole("figure", { name: "SSD 사용률 추이" })).not.toBeInTheDocument();
  expect(within(trend).getByRole("figure", { name: "CPU 단일 코어 (3회 중앙값) 추이" })).toBeInTheDocument();
  expect(trend.textContent).not.toContain(pro.serial);
});

test("활성화 잠금이 켜진 진단은 잠금·디스크 상태와 점검 알림에 잠금이 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.checks = { activationLock: "ON", diskEncryption: "OFF", osDiskHealth: "OK" };
  diag.flags = [{ kind: "ACTIVATION_LOCK_ON", baseRunId: diag.current.runId, detail: {} }];
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(panel).toHaveTextContent("활성화 잠금 켜짐 · 디스크 암호화 꺼짐 · OS 디스크 상태 정상");
  expect(panel).toHaveTextContent("활성화 잠금(나의 Mac 찾기)이 켜져 있습니다");
});

test("checks가 없는 이전 에이전트 진단은 잠금 상태를 '확인 안 함'으로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent("확인 안 함 (이전 버전 에이전트)");
});

test("Windows 진단은 읽지 않는 활성화 잠금·OS 디스크 상태를 '해당 없음'으로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.os = "WINDOWS";
  diag.current.checks = { activationLock: null, diskEncryption: "ON", osDiskHealth: null };
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent(
    "활성화 잠금 해당 없음 · 디스크 암호화 켜짐 · OS 디스크 상태 해당 없음",
  );
});

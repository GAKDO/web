// 이 파일이 확인하는 것: 관리자 렌탈 상세 시점 칸의 "진단 결과". 고객 노트북에서 진단 프로그램(agent)이 올린
// 배터리·충전 횟수·SSD·성능 측정·보안 상태(활성화 잠금, 디스크 암호화, 백신 등)와 점검 알림을 보여 주고,
// 진단 추이 그래프와 "진단 다시 하기"도 본다.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint, CheckpointDiagnostics } from "../../shared/api/types";
import { db } from "../../shared/mocks/db";

// 테스트 도구: 지금 시각.
const now = new Date().toISOString();

// 테스트 도구: 기기 C02AIR0002로 출고 시점 상태를 원하는 값으로 맞춘 렌탈을 넣는다.
function openRental(status: Checkpoint["status"]) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoint: Checkpoint = { checkpointId: nanoid(), type: "OUT", status, occurredAt: now };
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3201", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints: [checkpoint] });
  return { rentalId, checkpointId: checkpoint.checkpointId };
}

// 테스트 도구: macOS 진단 한 건(배터리 93.6%·충전 37회, SSD 사용률 2%, CPU Apple M2, 디스크 읽기 1482.6MB/s, 이전 진단·알림 없음).
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

// [상황] 진단이 아직 올라오지 않은 렌탈 상세를 연다.
// [기대] 출고 칸에 "아직 올라온 진단이 없습니다"가 보인다.
test("진단이 아직 없으면 렌탈 상세 시점 칸에 '아직 올라온 진단이 없습니다'가 보인다", async () => {
  const { rentalId } = openRental("OPEN");
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByText(/아직 올라온 진단이 없습니다/)).toBeInTheDocument();
});

// [상황] 진단 프로그램이 올린 진단이 있는 렌탈 상세를 연다.
// [기대] 진단 결과에 배터리 93.6%, 37회, SSD "사용률 2%", 점검 알림 "없음", "디스크 읽기 1,483 MB/s"가 보인다.
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

// [상황] 봉인된 시점에 진단이 있다.
// [기대] 봉인 뒤에도 진단 결과가 그대로 보인다.
test("봉인된 시점도 올라온 진단은 그대로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("SEALED");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent("93.6%");
});

// [상황] 진단이 이미 올라온 시점을 본다.
// [기대] 페어링 코드 버튼이 사라진다(이미 쓴 코드라 다시 만들 필요 없음).
test("진단이 올라온 시점은 다 쓴 페어링 코드 버튼을 가린다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(step).queryByRole("button", { name: /페어링 코드/ })).not.toBeInTheDocument();
});

// [상황] 진단이 여러 번 쌓인 기기(C02PRO0001)의 렌탈에서 "진단 추이 보기"를 누른다.
// [기대] 배터리 최대 용량이 날짜 순 꺾은선으로 보이고 마지막 값이 "최근 84.0%"다. 한 번도 못 읽은 SSD는 그래프가 없고,
//        CPU 단일 코어 그래프는 있다. 추이 영역 어디에도 시리얼이 드러나지 않는다.
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

// [상황] 진단에 활성화 잠금(나의 Mac 찾기)이 켜져 있다는 결과와 알림이 있다.
// [기대] 상태 줄에 "활성화 잠금 켜짐 · 디스크 암호화 꺼짐 · OS 디스크 상태 정상", 알림에 잠금이 켜져 있다는 문장이 보인다
//        (잠금이 켜진 채 반납되면 다음 사람이 쓸 수 없음).
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

// [상황] 보안 상태 칸이 없는 예전 진단 프로그램의 진단이다.
// [기대] 잠금 상태를 "확인 안 함 (이전 버전 에이전트)"로 보인다.
test("checks가 없는 이전 에이전트 진단은 잠금 상태를 '확인 안 함'으로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  expect(await within(step).findByRole("region", { name: "진단 결과" })).toHaveTextContent("확인 안 함 (이전 버전 에이전트)");
});

// [상황] Windows 진단이라 활성화 잠금·OS 디스크 상태를 읽지 않았다.
// [기대] 두 항목은 "해당 없음", 디스크 암호화는 "켜짐"으로 보인다.
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

// [상황] Windows 진단에서 백신(Defender)이 꺼져 있고 위협 탐지 기록이 2건이다.
// [기대] 보안 보호 줄에 "꺼짐 · 위협 탐지 기록 2건", 알림에 보호가 꺼져 있다는 문장과 새 악성코드 탐지 기록 문장이 보인다.
test("Windows 진단에서 Defender가 꺼지고 위협 기록이 늘면 보안 보호 줄과 점검 알림에 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.os = "WINDOWS";
  diag.current.checks = { activationLock: null, diskEncryption: "OFF", osDiskHealth: null, securityProtection: "OFF", threatCount: 2 };
  diag.flags = [
    { kind: "SECURITY_PROTECTION_OFF", baseRunId: diag.current.runId, detail: {} },
    { kind: "THREAT_DETECTED", baseRunId: diag.current.runId, detail: {} },
  ];
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(panel).toHaveTextContent("꺼짐 · 위협 탐지 기록 2건");
  expect(panel).toHaveTextContent("백신·시스템 보호(Defender·Gatekeeper·SIP)가 꺼져 있습니다");
  expect(panel).toHaveTextContent("새 악성코드 탐지 기록이 있습니다");
});

// [상황] 보안 보호 칸이 없는 예전 진단 프로그램의 진단이다.
// [기대] 보안 보호 줄이 "확인 안 함 (이전 버전 에이전트이거나 읽지 못함)"이다.
test("보안 보호를 읽지 않은 이전 에이전트 진단은 '확인 안 함'으로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.checks = { activationLock: "OFF", diskEncryption: "OFF", osDiskHealth: "OK" };
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(panel).getByText("보안 보호(백신·시스템 보호)").nextElementSibling).toHaveTextContent("확인 안 함 (이전 버전 에이전트이거나 읽지 못함)");
});

// [상황] 서버가 보안 보호·위협 수를 비어 있음(null)으로 준다.
// [기대] 위와 같은 "확인 안 함" 안내가 보인다.
test("서버가 null로 준 보안 보호도 같은 안내로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.checks = { activationLock: "ON", diskEncryption: "OFF", osDiskHealth: "OK", securityProtection: null, threatCount: null };
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(panel).getByText("보안 보호(백신·시스템 보호)").nextElementSibling).toHaveTextContent("확인 안 함 (이전 버전 에이전트이거나 읽지 못함)");
});

// [상황] 봉인 전 시점에서 "진단 다시 하기"를 누르고 확인 창에서 "다시 진단하기"를 누른다.
// [기대] 지금 진단은 이전 진단으로 남는다는 안내가 보이고, 확인하면 지금 진단이 비며 페어링 코드를 다시 만들 수 있다.
test("봉인 전 시점에서 진단 다시 하기를 확인하면 지금 진단이 비고 페어링 코드를 다시 만들 수 있다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  await within(step).findByRole("region", { name: "진단 결과" });
  await userEvent.click(within(step).getByRole("button", { name: "진단 다시 하기" }));
  expect(within(step).getByRole("note")).toHaveTextContent("이전 진단으로 남고");
  await userEvent.click(within(step).getByRole("button", { name: "다시 진단하기" }));
  expect(await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" })).toBeInTheDocument();
  expect(within(step).queryByRole("region", { name: "진단 결과" })).not.toBeInTheDocument();
  expect(db.report.diagnostics.has(checkpointId)).toBe(false);
});

// [상황] "진단 다시 하기"를 누른 뒤 "취소"를 누른다.
// [기대] 아무것도 바뀌지 않고 진단이 그대로다.
test("진단 다시 하기는 취소하면 아무것도 바뀌지 않는다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  await within(step).findByRole("region", { name: "진단 결과" });
  await userEvent.click(within(step).getByRole("button", { name: "진단 다시 하기" }));
  await userEvent.click(within(step).getByRole("button", { name: "취소" }));
  expect(within(step).getByRole("button", { name: "진단 다시 하기" })).toBeInTheDocument();
  expect(db.report.diagnostics.has(checkpointId)).toBe(true);
});

// [상황] 봉인된 시점에 진단이 있다.
// [기대] "진단 다시 하기" 버튼이 없다(봉인된 기록은 바꾸지 않음).
test("봉인된 시점에는 진단 다시 하기 버튼이 없다", async () => {
  const { rentalId, checkpointId } = openRental("SEALED");
  db.report.diagnostics.set(checkpointId, diagnostics(checkpointId));
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(step).queryByRole("button", { name: "진단 다시 하기" })).not.toBeInTheDocument();
});

// [상황] macOS 진단에서 보안 보호가 켜져 있다.
// [기대] 보안 보호 줄에 "Gatekeeper 켜짐 · 시스템 무결성 보호(SIP) 켜짐"이 보인다.
test("macOS 진단에서 Gatekeeper·SIP가 켜져 있으면 보안 보호 줄에 두 항목이 켜짐으로 보인다", async () => {
  const { rentalId, checkpointId } = openRental("OPEN");
  const diag = diagnostics(checkpointId);
  diag.current.checks = { activationLock: "ON", diskEncryption: "OFF", osDiskHealth: "OK", securityProtection: "ON" };
  db.report.diagnostics.set(checkpointId, diag);
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const step = await screen.findByRole("listitem", { name: "출고" });
  const panel = await within(step).findByRole("region", { name: "진단 결과" });
  expect(within(panel).getByText("보안 보호(백신·시스템 보호)").nextElementSibling).toHaveTextContent(
    "Gatekeeper 켜짐 · 시스템 무결성 보호(SIP) 켜짐",
  );
});

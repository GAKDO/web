// 이 파일이 확인하는 것: 관리자의 렌탈 만들기와 렌탈 목록. 사용 가능한 기기로만 렌탈을 만들 수 있고,
// 렌탈 상세는 출고 → 수령 → 반납 순서로 시점을 시작한다. 목록에서는 상태·등급으로 거르고 기기를 검색한다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import { db, mockDevice } from "../../shared/mocks/db";

// 테스트 도구: 클릭·입력을 흉내 내는 도구 만들기.
const user = () => userEvent.setup();
// 테스트 도구: 렌탈 만들기 화면의 기기 선택지 글자 목록.
const options = () => within(screen.getByLabelText("기기")).getAllByRole("option").map((o) => o.textContent);
// 테스트 도구: 렌탈 상세의 시점 칸(출고·수령·반납)을 이름으로 찾는다.
const step = (name: string) => screen.getByRole("listitem", { name });

// 테스트 도구: 관리자로 렌탈 만들기 화면을 열고 기기 목록이 올 때까지 기다린다.
async function openCreate() {
  const u = user();
  const view = renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  return { u, ...view };
}

// 테스트 도구: 기기를 고르고 대여자 참조 번호를 넣어 "렌탈 만들기"를 누른다.
async function createWith(u: ReturnType<typeof user>, optionText: string, renterRef = "R-2001") {
  await u.selectOptions(screen.getByLabelText("기기"), screen.getByRole("option", { name: optionText }));
  await u.type(screen.getByLabelText("대여자 참조 번호"), renterRef);
  await u.click(screen.getByRole("button", { name: "렌탈 만들기" }));
}

/** 사용 가능 기기로 렌탈을 만들어 상세를 연다 */
async function openNewRental() {
  const { u, router } = await openCreate();
  await createWith(u, "C02AIR0002 · MacBook Air (M2, 2022)");
  await screen.findByRole("listitem", { name: "출고" });
  const rentalId = router.state.location.pathname.split("/").at(-1) ?? "";
  return { u, rentalId };
}

// [상황] 사용 가능한 기기와 대여자 참조 번호 R-2001로 렌탈을 만든다.
// [기대] 렌탈 상세가 열리고, "출고 시작"만 누를 수 있으며 수령·반납 시작은 막혀 있다(순서대로만 진행). 참조 번호도 보인다.
test("사용 가능 기기로 대여자 참조 번호를 넣고 렌탈을 만들면 렌탈 상세가 열리고 출고 시작 버튼만 누를 수 있다", async () => {
  await openNewRental();
  expect(within(step("출고")).getByRole("button", { name: "출고 시작" })).toBeEnabled();
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
  expect(within(step("반납")).getByRole("button", { name: "반납 시작" })).toBeDisabled();
  expect(screen.getByText(/대여자 참조 번호 R-2001/)).toBeInTheDocument();
});

// [상황] 렌탈 만들기의 기기 목록을 보고, "다른 상태 기기도 보기"를 켠다.
// [기대] 처음엔 사용 가능 기기만, 켜면 수리 중·폐기 기기가 상태 표시와 함께 보인다.
test("기기 고르는 목록은 사용 가능 기기만 보이고, 다른 상태 기기도 보기를 켜면 수리 중·폐기 기기가 상태 표시와 함께 보인다", async () => {
  const { u } = await openCreate();
  expect(options().some((o) => o?.includes("수리 중") || o?.includes("폐기"))).toBe(false);
  await u.click(screen.getByLabelText("다른 상태 기기도 보기"));
  await waitFor(() => expect(options()).toContain("C02AIR0003 · MacBook Air (M2, 2022) (수리 중)"));
  expect(options()).toContain("C02PRO0002 · MacBook Pro 14 (M3, 2023) (폐기)");
});

// [상황] 수리 중 기기와 폐기 기기로 각각 렌탈을 만들려 한다.
// [기대] 서버가 409로 거절하고, "이 기기는 (수리 중/폐기) 상태라 렌탈을 만들 수 없습니다…"처럼 이유를 밝힌 문장이 보인다.
test.each([
  ["수리 중", "C02AIR0003 · MacBook Air (M2, 2022) (수리 중)"],
  ["폐기", "C02PRO0002 · MacBook Pro 14 (M3, 2023) (폐기)"],
])("%s 기기로 렌탈을 만들면 서버의 409가 기기 상태를 밝힌 문장으로 보인다", async (label, optionText) => {
  const { u } = await openCreate();
  await u.click(screen.getByLabelText("다른 상태 기기도 보기"));
  await waitFor(() => expect(options()).toContain(optionText));
  await createWith(u, optionText);
  expect(await screen.findByRole("alert")).toHaveTextContent(`이 기기는 ${label} 상태라 렌탈을 만들 수 없습니다. 사용 가능한 기기를 고르세요.`);
});

// [상황] 이미 진행 중인 렌탈이 있는 기기로 또 렌탈을 만들고, 안내 속 링크를 누른다.
// [기대] "이 기기로 진행 중인 렌탈이 이미 있습니다"와 "진행 중인 렌탈 보기" 링크가 보이고, 누르면 진행 중 렌탈 목록이 열린다.
test("진행 중인 렌탈이 있는 기기로 또 렌탈을 만들면 문장과 진행 중인 렌탈 보기 링크가 보인다", async () => {
  const { u, router } = await openCreate();
  await createWith(u, "C02AIR0001 · MacBook Air (M2, 2022)");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("이 기기로 진행 중인 렌탈이 이미 있습니다");
  await u.click(within(alert).getByRole("link", { name: "진행 중인 렌탈 보기" }));
  expect(router.state.location.search).toBe("?status=OPEN");
  expect(await screen.findByRole("listitem", { name: "C02AIR0001" })).toBeInTheDocument();
});

// [상황] 출고 봉인·수령 촬영됨인 렌탈을 하나 더 넣고 렌탈 목록을 연다.
// [기대] 렌탈마다 시리얼·기종·상태(진행 중)·지금 시점·만든 날이 보인다. 새 렌탈은 "지금 시점: 수령 · 촬영됨"이다.
test("렌탈 목록을 열면 렌탈마다 기기 시리얼·기종·렌탈 상태·지금 시점·만든 날이 보인다", async () => {
  const device = db.devices[2];
  const at = new Date().toISOString();
  db.rentals.push({
    rentalId: nanoid(), deviceId: device.deviceId, renterRef: "R-2101", status: "OPEN", startedAt: at, endedAt: null, createdAt: at,
    checkpoints: [
      { checkpointId: nanoid(), type: "OUT", status: "SEALED", occurredAt: at },
      { checkpointId: nanoid(), type: "RCV", status: "CAPTURED", occurredAt: at },
    ],
  });
  renderAsAdmin("/admin/rentals");
  const row = await screen.findByRole("listitem", { name: "C02AIR0001" });
  await waitFor(() => expect(within(row).getByText("MacBook Air (M2, 2022)")).toBeInTheDocument());
  expect(within(row).getByText("진행 중")).toBeInTheDocument();
  expect(within(row).getByText("지금 시점: 시작 전")).toBeInTheDocument();
  expect(within(row).getByText(/만든 날 2026\. 11\. 1\./)).toBeInTheDocument();
  const started = screen.getByRole("listitem", { name: device.serial });
  expect(within(started).getByText("지금 시점: 수령 · 촬영됨")).toBeInTheDocument();
});

// [상황] 기기를 100대로 늘리고 기기 목록에서 BULK042를 검색한다.
// [기대] 1초 안에 검색 결과가 보인다(성능 기준).
test("기기 100대 목록에서 검색 결과가 1초 안에 보인다", async () => {
  const model = db.models[0];
  for (let i = 0; i < 92; i += 1) db.devices.push(mockDevice(`BULK${String(i).padStart(3, "0")}`, model, "ACTIVE"));
  const u = user();
  renderAsAdmin("/admin/devices");
  await screen.findByRole("listitem", { name: "C02AIR0001" });
  const startedAt = performance.now();
  await u.type(screen.getByLabelText("검색"), "BULK042");
  await screen.findByRole("listitem", { name: "BULK042" }, { timeout: 1000 });
  expect(performance.now() - startedAt).toBeLessThan(1000);
});

// [상황] 모든 검사 등급을 A로 바꾼 뒤, 렌탈 목록에서 "문제 있는 것만" 거르고, 이어서 렌탈 상태도 진행 중으로 거른다.
// [기대] "지금 문제 있는 렌탈이 없습니다"가 보이고, 주소에 problem=1이 붙으며 상태를 바꿔도 함께 남는다(주소를 공유해도 같은 목록).
test("렌탈 목록에서 검사 등급을 문제 있는 것만으로 고르면 주소에 problem=1이 붙고 문제 있는 렌탈만 센다(contracts #23)", async () => {
  db.report.inspections.forEach((ins) => {
    if (ins.grade && ins.grade !== "A") ins.grade = "A";
  });
  const u = user();
  const { router } = renderAsAdmin("/admin/rentals");
  await screen.findByText(/^총/);
  await u.selectOptions(screen.getByLabelText("검사 등급"), "1");
  expect(await screen.findByText(/지금 문제 있는 렌탈이 없습니다/)).toBeInTheDocument();
  expect(router.state.location.search).toContain("problem=1");
  await u.selectOptions(screen.getByLabelText("렌탈 상태"), "OPEN");
  expect(router.state.location.search).toContain("problem=1");
  expect(router.state.location.search).toContain("status=OPEN");
});

// [상황] 출고 시점이 C등급인 렌탈을 넣고 렌탈 목록에서 그 등급 표시를 누른다.
// [기대] "문제 있음 · C등급"이 보이고, 누르면 그 시점의 검사 결과 화면으로 간다.
test("렌탈 목록의 검사 결과 칸은 지금 시점 등급을 문제 있음·없음과 함께 보이고, 누르면 그 검사 결과로 간다(contracts #42)", async () => {
  const device = db.devices[2];
  const at = new Date().toISOString();
  const checkpointId = nanoid();
  const rentalId = nanoid();
  db.rentals.push({
    rentalId, deviceId: device.deviceId, renterRef: "R-2201", status: "OPEN", startedAt: at, endedAt: null, createdAt: at,
    checkpoints: [{ checkpointId, type: "OUT", status: "SEALED", occurredAt: at }],
  });
  const base = [...db.report.inspections.values()][0];
  db.report.inspections.set(checkpointId, { ...base, checkpointId, grade: "C" });
  const u = user();
  const { router } = renderAsAdmin("/admin/rentals");
  const row = await screen.findByRole("listitem", { name: device.serial });
  const badge = await within(row).findByText("문제 있음 · C등급");
  await u.click(badge);
  await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/inspections/${rentalId}/${checkpointId}`));
});

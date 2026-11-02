import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db, mockDevice } from "../../shared/mocks/db";

const user = () => userEvent.setup();
const options = () => within(screen.getByLabelText("기기")).getAllByRole("option").map((o) => o.textContent);
const step = (name: string) => screen.getByRole("listitem", { name });

async function openCreate() {
  const u = user();
  const view = renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  return { u, ...view };
}

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

test("사용 가능 기기로 대여자 참조 번호를 넣고 렌탈을 만들면 렌탈 상세가 열리고 출고 시작 버튼만 누를 수 있다", async () => {
  await openNewRental();
  expect(within(step("출고")).getByRole("button", { name: "출고 시작" })).toBeEnabled();
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
  expect(within(step("반납")).getByRole("button", { name: "반납 시작" })).toBeDisabled();
  expect(screen.getByText(/대여자 참조 번호 R-2001/)).toBeInTheDocument();
});

test("기기 고르는 목록은 사용 가능 기기만 보이고, 다른 상태 기기도 보기를 켜면 수리 중·폐기 기기가 상태 표시와 함께 보인다", async () => {
  const { u } = await openCreate();
  expect(options().some((o) => o?.includes("수리 중") || o?.includes("폐기"))).toBe(false);
  await u.click(screen.getByLabelText("다른 상태 기기도 보기"));
  await waitFor(() => expect(options()).toContain("C02AIR0003 · MacBook Air (M2, 2022) (수리 중)"));
  expect(options()).toContain("C02PRO0002 · MacBook Pro 14 (M3, 2023) (폐기)");
});

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

test("진행 중인 렌탈이 있는 기기로 또 렌탈을 만들면 문장과 진행 중인 렌탈 보기 링크가 보인다", async () => {
  const { u, router } = await openCreate();
  await createWith(u, "C02AIR0001 · MacBook Air (M2, 2022)");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("이 기기로 진행 중인 렌탈이 이미 있습니다");
  await u.click(within(alert).getByRole("link", { name: "진행 중인 렌탈 보기" }));
  expect(router.state.location.search).toBe("?status=OPEN");
  expect(await screen.findByRole("listitem", { name: "C02AIR0001" })).toBeInTheDocument();
});

test("렌탈 목록을 열면 렌탈마다 기기 시리얼·기종·렌탈 상태·만든 날이 보인다", async () => {
  renderAsAdmin("/admin/rentals");
  const row = await screen.findByRole("listitem", { name: "C02AIR0001" });
  await waitFor(() => expect(within(row).getByText("MacBook Air (M2, 2022)")).toBeInTheDocument());
  expect(within(row).getByText("진행 중")).toBeInTheDocument();
  expect(within(row).getByText(/만든 날 2026\. 11\. 1\./)).toBeInTheDocument();
});

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

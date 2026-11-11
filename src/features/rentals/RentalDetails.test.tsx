import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { dueState, todayKst } from "./dueDate";

// contracts #23(11/10): 렌탈 고객 이름·반납 예정일·메모, 목록 총 N건

const options = () => within(screen.getByLabelText("기기")).getAllByRole("option").map((o) => o.textContent);

test("렌탈을 만들 때 고객 이름·반납 예정일·메모를 적으면 상세에 보이고, 고치기로 바꾸거나 비울 수 있다", async () => {
  const u = userEvent.setup();
  const { router } = renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  await u.selectOptions(screen.getByLabelText("기기"), screen.getByRole("option", { name: "C02AIR0002 · MacBook Air (M2, 2022)" }));
  await u.type(screen.getByLabelText("대여자 참조 번호"), "R-3001");
  await u.type(screen.getByLabelText("고객 이름 (선택)"), "  김고객 ");
  await u.type(screen.getByLabelText("반납 예정일 (선택)"), "2026-11-19");
  await u.type(screen.getByLabelText("메모 (선택)"), "충전기 함께");
  await u.click(screen.getByRole("button", { name: "렌탈 만들기" }));
  await screen.findByRole("listitem", { name: "출고" });
  const rentalId = router.state.location.pathname.split("/").at(-1) ?? "";
  const saved = db.rentals.find((r) => r.rentalId === rentalId);
  expect(saved).toMatchObject({ customerName: "김고객", dueAt: "2026-11-19", note: "충전기 함께" });
  expect(screen.getByText("김고객")).toBeInTheDocument();
  expect(screen.getByText(/2026\. 11\. 19\./)).toBeInTheDocument();
  expect(screen.getByText("충전기 함께")).toBeInTheDocument();

  await u.click(screen.getByRole("button", { name: "고치기" }));
  const form = screen.getByRole("form", { name: "고객 정보 고치기" });
  await u.clear(within(form).getByLabelText("메모"));
  await u.clear(within(form).getByLabelText("고객 이름"));
  await u.type(within(form).getByLabelText("고객 이름"), "박고객");
  await u.click(within(form).getByRole("button", { name: "저장" }));
  expect(await screen.findByText("박고객")).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "고객 정보 고치기" })).not.toBeInTheDocument();
  expect(db.rentals.find((r) => r.rentalId === rentalId)).toMatchObject({ customerName: "박고객", note: null, dueAt: "2026-11-19" });
});

test("고객 이름 없이 만든 렌탈도 상세에 '적지 않음'으로 보이고 그대로 만들어진다(이름은 선택)", async () => {
  const u = userEvent.setup();
  renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  await u.selectOptions(screen.getByLabelText("기기"), screen.getByRole("option", { name: "C02AIR0002 · MacBook Air (M2, 2022)" }));
  await u.type(screen.getByLabelText("대여자 참조 번호"), "R-3002");
  await u.click(screen.getByRole("button", { name: "렌탈 만들기" }));
  expect(await screen.findByText("적지 않음")).toBeInTheDocument();
  expect(screen.getByText("정하지 않음")).toBeInTheDocument();
});

test("렌탈 목록에 총 건수와 고객·반납 예정이 보이고, 진행 중인데 예정일이 지났으면 지남이 붙는다", async () => {
  const open = db.rentals.find((r) => r.status === "OPEN");
  if (!open) throw new Error("진행 중 렌탈 없음");
  open.customerName = "이고객";
  open.dueAt = "2026-01-02";
  renderAsAdmin("/admin/rentals");
  const total = await screen.findByText(/^총/);
  expect(Number(total.querySelector("strong")?.textContent)).toBe(db.rentals.length);
  const row = (await screen.findByText("이고객")).closest("li");
  expect(row).toHaveTextContent("반납 예정 2026. 1. 2. · 지남");
});

test("반납 예정일: 날짜가 없으면 표시하지 않고, 반납·종료된 렌탈은 지나도 지남으로 보지 않는다", () => {
  const now = new Date("2026-11-10T16:00:00Z"); // 한국 시간 11/11 01:00
  expect(todayKst(now)).toBe("2026-11-11");
  expect(dueState({ dueAt: null, status: "OPEN" }, now)).toBeNull();
  expect(dueState({ dueAt: "2026-11-10", status: "OPEN" }, now)).toEqual({ label: "2026. 11. 10.", overdue: true });
  expect(dueState({ dueAt: "2026-11-11", status: "OPEN" }, now)?.overdue).toBe(false);
  expect(dueState({ dueAt: "2026-11-10", status: "RETURNED" }, now)?.overdue).toBe(false);
});

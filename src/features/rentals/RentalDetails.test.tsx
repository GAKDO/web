import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { dueInputError, dueState, todayKst } from "./dueDate";

/** 한국 시간 오늘에서 days일 뒤(YYYY-MM-DD). 테스트가 날짜가 지나도 깨지지 않게 */
const kstPlus = (days: number) => todayKst(new Date(Date.now() + days * 86_400_000));
const dotted = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
};

// contracts #23(11/10): 렌탈 고객 이름·반납 예정일·메모, 목록 총 N건

const options = () => within(screen.getByLabelText("기기")).getAllByRole("option").map((o) => o.textContent);

test("렌탈을 만들 때 고객 이름·반납 예정일·메모를 적으면 상세에 보이고, 고치기로 바꾸거나 비울 수 있다", async () => {
  const u = userEvent.setup();
  const { router } = renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  await u.selectOptions(screen.getByLabelText("기기"), screen.getByRole("option", { name: "C02AIR0002 · MacBook Air (M2, 2022)" }));
  await u.type(screen.getByLabelText("대여자 참조 번호"), "R-3001");
  await u.type(screen.getByLabelText("고객 이름 (선택)"), "  김고객 ");
  const due = kstPlus(6);
  await u.type(screen.getByLabelText("반납 예정일 (선택)"), due);
  await u.type(screen.getByLabelText("메모 (선택)"), "충전기 함께");
  await u.click(screen.getByRole("button", { name: "렌탈 만들기" }));
  await screen.findByRole("listitem", { name: "출고" });
  const rentalId = router.state.location.pathname.split("/").at(-1) ?? "";
  const saved = db.rentals.find((r) => r.rentalId === rentalId);
  expect(saved).toMatchObject({ customerName: "김고객", dueAt: due, note: "충전기 함께" });
  expect(screen.getByText("김고객")).toBeInTheDocument();
  expect(screen.getByText(new RegExp(dotted(due).replace(/\./g, "\\.")))).toBeInTheDocument();
  expect(screen.getByText("충전기 함께")).toBeInTheDocument();

  await u.click(screen.getByRole("button", { name: "고치기" }));
  const form = screen.getByRole("form", { name: "고객 정보 고치기" });
  await u.clear(within(form).getByLabelText("메모"));
  await u.clear(within(form).getByLabelText("고객 이름"));
  await u.type(within(form).getByLabelText("고객 이름"), "박고객");
  await u.click(within(form).getByRole("button", { name: "저장" }));
  expect(await screen.findByText("박고객")).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "고객 정보 고치기" })).not.toBeInTheDocument();
  expect(db.rentals.find((r) => r.rentalId === rentalId)).toMatchObject({ customerName: "박고객", note: null, dueAt: due });
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

test("반납 예정일: 렌탈 만들기에서 오늘(한국 시간)보다 과거를 넣으면 안내가 뜨고 만들 수 없으며, 오늘은 된다", async () => {
  const u = userEvent.setup();
  renderAsAdmin("/admin/rentals/new");
  await waitFor(() => expect(options().length).toBeGreaterThan(1));
  await u.selectOptions(screen.getByLabelText("기기"), screen.getByRole("option", { name: "C02AIR0002 · MacBook Air (M2, 2022)" }));
  await u.type(screen.getByLabelText("대여자 참조 번호"), "R-3003");
  const due = screen.getByLabelText("반납 예정일 (선택)");
  expect(due).toHaveAttribute("min", todayKst());
  expect(screen.getByText("오늘 이후 날짜만 고를 수 있습니다.")).toBeInTheDocument();
  await u.type(due, kstPlus(-7));
  expect(screen.getByRole("alert")).toHaveTextContent("반납 예정일은 오늘(");
  expect(screen.getByRole("button", { name: "렌탈 만들기" })).toBeDisabled();
  await u.clear(due);
  await u.type(due, todayKst());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "렌탈 만들기" })).toBeEnabled();
});

test("반납 예정일: 이미 지난 날짜가 저장된 렌탈은 다른 칸을 그대로 고칠 수 있고, 다른 과거 날짜로 바꾸면 막힌다", async () => {
  const open = db.rentals.find((r) => r.status === "OPEN");
  if (!open) throw new Error("진행 중 렌탈 없음");
  const past = kstPlus(-7);
  open.dueAt = past;
  open.customerName = "옛고객";
  const u = userEvent.setup();
  renderAsAdmin(`/admin/rentals/${open.rentalId}`);
  await u.click(await screen.findByRole("button", { name: "고치기" }));
  const form = screen.getByRole("form", { name: "고객 정보 고치기" });
  const due = within(form).getByLabelText("반납 예정일");
  expect(due).not.toHaveAttribute("min");
  await u.clear(due);
  await u.type(due, kstPlus(-8));
  expect(within(form).getByRole("alert")).toHaveTextContent("반납 예정일은 오늘(");
  expect(within(form).getByRole("button", { name: "저장" })).toBeDisabled();
  await u.clear(due);
  await u.type(due, past);
  await u.clear(within(form).getByLabelText("고객 이름"));
  await u.type(within(form).getByLabelText("고객 이름"), "새고객");
  await u.click(within(form).getByRole("button", { name: "저장" }));
  expect(await screen.findByText("새고객")).toBeInTheDocument();
  expect(db.rentals.find((r) => r.rentalId === open.rentalId)).toMatchObject({ customerName: "새고객", dueAt: past });
});

test("반납 예정일 입력 검사: 빈 값·오늘·미래·저장된 값 그대로는 통과, 그 밖의 과거는 오류", () => {
  const now = new Date("2026-11-12T16:00:00Z"); // 한국 시간 11/13 01:00
  expect(dueInputError("", null, now)).toBeNull();
  expect(dueInputError("2026-11-13", null, now)).toBeNull();
  expect(dueInputError("2026-11-20", null, now)).toBeNull();
  expect(dueInputError("2026-11-06", "2026-11-06", now)).toBeNull();
  expect(dueInputError("2026-11-12", null, now)).toBe("반납 예정일은 오늘(2026. 11. 13.) 이후로 정해 주세요.");
});

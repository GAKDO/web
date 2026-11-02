import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

async function openList() {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await screen.findByRole("listitem", { name: "C02AIR0001" });
  return user;
}

const shownSerials = () => within(screen.getByRole("list", { name: "기기" })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
const card = (serial: string) => screen.getByRole("listitem", { name: serial });

test("기종을 고르면 그 기종의 기기만 보인다", async () => {
  const user = await openList();
  await user.selectOptions(screen.getByLabelText("기종"), "LG gram 16 (2024)");
  await waitFor(() => expect(shownSerials()).toEqual(["LGGRAM0001", "LGGRAM0002", "LGGRAM0003"]));
});

test("상태(사용 가능·수리 중·폐기)를 고르면 그 상태의 기기만 보인다", async () => {
  const user = await openList();
  await user.selectOptions(screen.getByLabelText("상태"), "수리 중");
  await waitFor(() => expect(shownSerials()).toEqual(["C02AIR0003", "LGGRAM0002"]));
});

test("검색 칸에 시리얼이나 자산번호 일부를 넣으면 맞는 기기만 보인다", async () => {
  const user = await openList();
  await user.type(screen.getByLabelText("검색"), "pro0");
  await waitFor(() => expect(shownSerials()).toEqual(["C02PRO0001", "C02PRO0002"]));
  await user.clear(screen.getByLabelText("검색"));
  await user.type(screen.getByLabelText("검색"), "TR-0201");
  await waitFor(() => expect(shownSerials()).toEqual(["LGGRAM0001"]));
});

test("사용 가능 기기를 수리 중으로 바꾸면 목록의 상태가 바로 바뀐다", async () => {
  const user = await openList();
  await user.click(within(card("C02AIR0002")).getByRole("button", { name: "수리 중으로" }));
  await waitFor(() => expect(within(card("C02AIR0002")).getByText("수리 중")).toBeInTheDocument());
});

test("진행 중인 렌탈이 있는 기기를 수리 중으로 바꾸면 사람이 읽는 문장이 보이고 상태는 그대로다", async () => {
  const user = await openList();
  await user.click(within(card("C02AIR0001")).getByRole("button", { name: "수리 중으로" }));
  expect(await within(card("C02AIR0001")).findByRole("alert")).toHaveTextContent(
    "진행 중인 렌탈이 있어 상태를 바꿀 수 없습니다. 렌탈을 먼저 종료하세요.",
  );
  expect(within(card("C02AIR0001")).getByText("사용 가능")).toBeInTheDocument();
});

test("폐기로 바꾸기를 누르면 확인 창이 먼저 뜨고, 폐기 뒤에도 그 기기는 목록(폐기 거르기)에 남는다", async () => {
  const user = await openList();
  await user.click(within(card("LGGRAM0003")).getByRole("button", { name: "폐기" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(db.devices.find((d) => d.serial === "LGGRAM0003")?.status).toBe("ACTIVE");
  await user.click(within(dialog).getByRole("button", { name: "폐기" }));
  await waitFor(() => expect(within(card("LGGRAM0003")).getByText("폐기")).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText("상태"), "폐기");
  await waitFor(() => expect(shownSerials()).toEqual(["C02PRO0002", "LGGRAM0003"]));
});

test("폐기 기기의 상태 메뉴는 수리 중으로 되돌리기만 고를 수 있고, 확인 창 뒤 수리 중으로 바뀐다", async () => {
  const user = await openList();
  const retired = card("C02PRO0002");
  expect(within(retired).getAllByRole("button").map((b) => b.textContent)).toEqual(["수리 중으로 되돌리기", "고치기"]);
  await user.click(within(retired).getByRole("button", { name: "수리 중으로 되돌리기" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "수리 중으로 되돌리기" }));
  await waitFor(() => expect(within(card("C02PRO0002")).getByText("수리 중")).toBeInTheDocument());
});

test("그사이 다른 관리자가 폐기한 기기를 사용 가능으로 바꾸면 수리 중을 거치라는 문장이 보이고 폐기로 보인다", async () => {
  const user = await openList();
  const stale = db.devices.find((d) => d.serial === "LGGRAM0002");
  if (stale) stale.status = "RETIRED";
  await user.click(within(card("LGGRAM0002")).getByRole("button", { name: "사용 가능으로" }));
  expect(await within(card("LGGRAM0002")).findByRole("alert")).toHaveTextContent(
    "폐기한 기기는 바로 사용 가능으로 바꿀 수 없습니다. 먼저 수리 중으로 되돌리세요.",
  );
  await waitFor(() => expect(within(card("LGGRAM0002")).getByText("폐기")).toBeInTheDocument());
});

test("기기 정보에서 색상·자산번호·OS를 고치면 저장되고, 시리얼·기종은 고칠 수 없게 보인다", async () => {
  const user = await openList();
  await user.click(within(card("LGGRAM0002")).getByRole("button", { name: "고치기" }));
  const form = screen.getByRole("form", { name: "LGGRAM0002 고치기" });
  expect(within(form).getByLabelText("시리얼")).toBeDisabled();
  expect(within(form).getByLabelText("기종")).toBeDisabled();
  await user.type(within(form).getByLabelText("색상"), "실버");
  await user.type(within(form).getByLabelText("자산번호"), "TR-0202");
  await user.click(within(form).getByRole("button", { name: "저장" }));
  await waitFor(() => expect(within(card("LGGRAM0002")).getByText("자산번호 TR-0202")).toBeInTheDocument());
  expect(db.devices.find((d) => d.serial === "LGGRAM0002")).toMatchObject({ color: "실버", assetNo: "TR-0202" });
});

test("결과가 많으면 더 보기로 다음 쪽을 불러온다", async () => {
  for (let i = 0; i < 20; i += 1) db.devices.push({ ...db.devices[5], deviceId: `extra-${i}`, serial: `EXTRA${i}` });
  const user = await openList();
  expect(shownSerials()).toHaveLength(20);
  await user.click(screen.getByRole("button", { name: "더 보기" }));
  await waitFor(() => expect(shownSerials()).toHaveLength(28));
});

// 이 파일이 확인하는 것: 관리 화면의 기기 목록. 기종·상태·검색으로 거르고, 상세를 펼쳐 상태(사용 가능·수리 중·폐기)를 바꾸거나
// 색상·자산번호·OS를 고친다. 상태는 사용 가능 ↔ 수리 중 → 폐기 → 수리 중 순서로만 바꿀 수 있다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// 테스트 도구: 관리자로 기기 목록을 열고 첫 기기가 보일 때까지 기다린다.
async function openList() {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await screen.findByRole("listitem", { name: "C02AIR0001" });
  return user;
}

// 테스트 도구: 지금 목록에 보이는 기기들의 시리얼 목록.
const shownSerials = () => within(screen.getByRole("list", { name: "기기" })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
// 테스트 도구: 시리얼로 목록의 기기 한 줄을 찾는다.
const card = (serial: string) => screen.getByRole("listitem", { name: serial });
/** 상세보기를 눌러 그 기기의 기본 정보·상태 바꾸기·고치기를 펼친다 */
async function openDetail(user: ReturnType<typeof userEvent.setup>, serial: string) {
  await user.click(within(card(serial)).getByRole("button", { name: "상세보기" }));
  return card(serial);
}

// [상황] 기종 거르기에서 LG gram 16을 고른다.
// [기대] LG gram 기기 3대만 보인다.
test("기종을 고르면 그 기종의 기기만 보인다", async () => {
  const user = await openList();
  await user.selectOptions(screen.getByLabelText("기종"), "LG gram 16 (2024)");
  await waitFor(() => expect(shownSerials()).toEqual(["LGGRAM0001", "LGGRAM0002", "LGGRAM0003"]));
});

// [상황] 상태 거르기에서 "수리 중"을 고른다.
// [기대] 수리 중인 기기 2대만 보인다.
test("상태(사용 가능·수리 중·폐기)를 고르면 그 상태의 기기만 보인다", async () => {
  const user = await openList();
  await user.selectOptions(screen.getByLabelText("상태"), "수리 중");
  await waitFor(() => expect(shownSerials()).toEqual(["C02AIR0003", "LGGRAM0002"]));
});

// [상황] 검색 칸에 시리얼 일부("pro0", 대소문자 무관)를 넣었다가, 자산번호(TR-0201)로 바꿔 넣는다.
// [기대] 각각 맞는 기기만 보인다.
test("검색 칸에 시리얼이나 자산번호 일부를 넣으면 맞는 기기만 보인다", async () => {
  const user = await openList();
  await user.type(screen.getByLabelText("검색"), "pro0");
  await waitFor(() => expect(shownSerials()).toEqual(["C02PRO0001", "C02PRO0002"]));
  await user.clear(screen.getByLabelText("검색"));
  await user.type(screen.getByLabelText("검색"), "TR-0201");
  await waitFor(() => expect(shownSerials()).toEqual(["LGGRAM0001"]));
});

// [상황] 사용 가능한 기기의 상세를 펼쳐 "수리 중으로"를 누른다.
// [기대] 목록의 상태가 바로 "수리 중"으로 바뀐다.
test("사용 가능 기기를 수리 중으로 바꾸면 목록의 상태가 바로 바뀐다", async () => {
  const user = await openList();
  await openDetail(user, "C02AIR0002");
  await user.click(within(card("C02AIR0002")).getByRole("button", { name: "수리 중으로" }));
  await waitFor(() => expect(within(card("C02AIR0002")).getByText("수리 중")).toBeInTheDocument());
});

// [상황] 진행 중인 렌탈이 있는 기기를 수리 중으로 바꾸려 한다.
// [기대] "진행 중인 렌탈이 있어 상태를 바꿀 수 없습니다. 렌탈을 먼저 종료하세요."가 보이고 상태는 사용 가능 그대로다.
test("진행 중인 렌탈이 있는 기기를 수리 중으로 바꾸면 사람이 읽는 문장이 보이고 상태는 그대로다", async () => {
  const user = await openList();
  await openDetail(user, "C02AIR0001");
  await user.click(within(card("C02AIR0001")).getByRole("button", { name: "수리 중으로" }));
  expect(await within(card("C02AIR0001")).findByRole("alert")).toHaveTextContent(
    "진행 중인 렌탈이 있어 상태를 바꿀 수 없습니다. 렌탈을 먼저 종료하세요.",
  );
  expect(within(card("C02AIR0001")).getByText("사용 가능")).toBeInTheDocument();
});

// [상황] 기기의 "폐기"를 누르고 확인 창에서 다시 "폐기"를 누른 뒤, 상태 거르기에서 폐기를 고른다.
// [기대] 확인 창이 뜨는 동안엔 아직 바뀌지 않는다. 폐기 뒤 목록에 "폐기"로 보이고, 폐기 거르기에도 남는다(이력 보존).
test("폐기로 바꾸기를 누르면 확인 창이 먼저 뜨고, 폐기 뒤에도 그 기기는 목록(폐기 거르기)에 남는다", async () => {
  const user = await openList();
  await openDetail(user, "LGGRAM0003");
  await user.click(within(card("LGGRAM0003")).getByRole("button", { name: "폐기" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(db.devices.find((d) => d.serial === "LGGRAM0003")?.status).toBe("ACTIVE");
  await user.click(within(dialog).getByRole("button", { name: "폐기" }));
  await waitFor(() => expect(within(card("LGGRAM0003")).getByText("폐기")).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText("상태"), "폐기");
  await waitFor(() => expect(shownSerials()).toEqual(["C02PRO0002", "LGGRAM0003"]));
});

// [상황] 폐기된 기기의 상세를 펼친다.
// [기대] 상태 버튼은 "수리 중으로 되돌리기"만 있고(그 외 닫기·고치기·기기 지우기), 확인 창을 거쳐 수리 중으로 바뀐다.
test("폐기 기기의 상태 메뉴는 수리 중으로 되돌리기만 고를 수 있고, 확인 창 뒤 수리 중으로 바뀐다", async () => {
  const user = await openList();
  const retired = await openDetail(user, "C02PRO0002");
  // 시리얼 눈 버튼은 빼고 본다
  expect(
    within(retired)
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("aria-label")?.startsWith("시리얼"))
      .map((b) => b.textContent),
  ).toEqual(["닫기", "수리 중으로 되돌리기", "고치기", "기기 지우기"]);
  await user.click(within(retired).getByRole("button", { name: "수리 중으로 되돌리기" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "수리 중으로 되돌리기" }));
  await waitFor(() => expect(within(card("C02PRO0002")).getByText("수리 중")).toBeInTheDocument());
});

// [상황] 화면을 연 사이 다른 관리자가 기기를 폐기했고, 이 화면에서 "사용 가능으로"를 누른다.
// [기대] "폐기한 기기는 바로 사용 가능으로 바꿀 수 없습니다. 먼저 수리 중으로 되돌리세요."가 보이고, 상태가 폐기로 새로 보인다.
test("그사이 다른 관리자가 폐기한 기기를 사용 가능으로 바꾸면 수리 중을 거치라는 문장이 보이고 폐기로 보인다", async () => {
  const user = await openList();
  const stale = db.devices.find((d) => d.serial === "LGGRAM0002");
  if (stale) stale.status = "RETIRED";
  await openDetail(user, "LGGRAM0002");
  await user.click(within(card("LGGRAM0002")).getByRole("button", { name: "사용 가능으로" }));
  expect(await within(card("LGGRAM0002")).findByRole("alert")).toHaveTextContent(
    "폐기한 기기는 바로 사용 가능으로 바꿀 수 없습니다. 먼저 수리 중으로 되돌리세요.",
  );
  await waitFor(() => expect(within(card("LGGRAM0002")).getByText("폐기")).toBeInTheDocument());
});

// [상황] 기기 "고치기"를 열고 색상과 자산번호를 넣어 저장한다.
// [기대] 시리얼은 고칠 칸 없이 가려진 글자로만 보이고(눈 버튼으로 확인), 기종은 고칠 수 없다. 색상·자산번호가 저장되고 목록에 보인다.
test("기기 정보에서 색상·자산번호·OS를 고치면 저장되고, 시리얼·기종은 고칠 수 없게 보인다", async () => {
  const user = await openList();
  await openDetail(user, "LGGRAM0002");
  await user.click(within(card("LGGRAM0002")).getByRole("button", { name: "고치기" }));
  const form = screen.getByRole("form", { name: "••••••0002 고치기" });
  // 시리얼은 고칠 칸이 아니라 가려진 글자로 보이고, 눈 버튼을 누르면 전체가 보인다
  expect(within(form).queryByRole("textbox", { name: "시리얼" })).not.toBeInTheDocument();
  await user.click(within(form).getByRole("button", { name: "시리얼 보기" }));
  expect(within(form).getByText("LGGRAM0002")).toBeInTheDocument();
  expect(within(form).getByLabelText("기종")).toBeDisabled();
  await user.type(within(form).getByLabelText("색상"), "실버");
  await user.type(within(form).getByLabelText("자산번호"), "TR-0202");
  await user.click(within(form).getByRole("button", { name: "저장" }));
  await waitFor(() => expect(within(card("LGGRAM0002")).getByText("TR-0202")).toBeInTheDocument());
  expect(db.devices.find((d) => d.serial === "LGGRAM0002")).toMatchObject({ color: "실버", assetNo: "TR-0202" });
});

// [상황] 기기가 28대라 한 쪽(20대)을 넘는다. 다음 쪽, 1쪽 버튼을 차례로 누른다.
// [기대] 첫 쪽 20대(이전 쪽 버튼은 막힘) → 2쪽은 남은 8대만(이어 붙이지 않음, 다음 쪽 막힘) → 1쪽으로 돌아오면 20대.
test("결과가 많으면 한 쪽씩 보이고, 다음 쪽·이전 쪽·쪽 번호로 넘긴다", async () => {
  for (let i = 0; i < 20; i += 1) db.devices.push({ ...db.devices[5], deviceId: `extra-${i}`, serial: `EXTRA${i}` });
  const user = await openList();
  expect(shownSerials()).toHaveLength(20);
  expect(screen.getByRole("button", { name: "이전 쪽" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "다음 쪽" }));
  // 이어 붙이지 않고 다음 쪽(남은 8대)만 보인다
  await waitFor(() => expect(shownSerials()).toHaveLength(8));
  expect(screen.getByRole("button", { name: "2쪽" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "다음 쪽" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "1쪽" }));
  await waitFor(() => expect(shownSerials()).toHaveLength(20));
});

// [상황] 목록의 한 줄을 보고, "상세보기"를 눌렀다가 "닫기"를 누른다.
// [기대] 한 줄엔 기종 이름·상태가 보이고 자산번호는 숨어 있다. 펼치면 같은 화면에서 자산번호 등 기본 정보가 보이고, 닫으면 다시 숨는다.
test("목록 한 줄에는 기기명·시리얼번호·상태·등록일이 보이고, 상세보기를 누르면 같은 화면에 기본 정보가 펼쳐진다", async () => {
  const user = await openList();
  const row = card("LGGRAM0001");
  expect(within(row).getByText("LG gram 16 (2024)")).toBeInTheDocument();
  expect(within(row).getByText("사용 가능")).toBeInTheDocument();
  expect(within(row).queryByText("TR-0201")).not.toBeInTheDocument();
  await openDetail(user, "LGGRAM0001");
  expect(within(row).getByText("TR-0201")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "닫기" })).toHaveAttribute("aria-expanded", "true");
  await user.click(within(row).getByRole("button", { name: "닫기" }));
  expect(within(row).queryByText("TR-0201")).not.toBeInTheDocument();
});

// [상황] 목록 줄과 펼친 상세에서 시리얼을 본다.
// [기대] 둘 다 끝 4자리만(••••••0001) 보이고, "시리얼 보기"를 눌러야 전체가 보이며 다시 가릴 수 있다.
test("목록과 펼친 상세 모두 시리얼을 가려 두고, 눈 버튼을 눌러야 전체 시리얼이 보인다", async () => {
  const user = await openList();
  const row = card("LGGRAM0001");
  expect(within(row).queryByText("LGGRAM0001")).not.toBeInTheDocument();
  expect(within(row).getByText("••••••0001")).toBeInTheDocument();
  await openDetail(user, "LGGRAM0001");
  expect(within(row).queryByText("LGGRAM0001")).not.toBeInTheDocument();
  await user.click(within(row).getByRole("button", { name: "시리얼 보기" }));
  expect(within(row).getByText("LGGRAM0001")).toBeInTheDocument();
  await user.click(within(row).getByRole("button", { name: "시리얼 가리기" }));
  expect(within(row).queryByText("LGGRAM0001")).not.toBeInTheDocument();
});

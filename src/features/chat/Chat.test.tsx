import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";

async function openChat() {
  await userEvent.click(await screen.findByRole("button", { name: "TRACE 도우미 열기" }));
  return screen.getByRole("dialog", { name: "TRACE 도우미" });
}

test("로그인하지 않은 사람도 첫 화면 오른쪽 아래 도우미를 열어 질문하고, 이어서 물으면 앞 대화까지 같이 보낸다", async () => {
  renderApp("/guide");
  const dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "노트북은 어떻게 빌려요?{Enter}");
  const log = within(dialog).getByRole("list", { name: "대화" });
  expect(await within(log).findByText("대화 1개를 받았어요. 질문: 노트북은 어떻게 빌려요?")).toBeInTheDocument();

  await userEvent.type(within(dialog).getByLabelText("질문"), "등급은요?{Enter}");
  expect(await within(log).findByText("대화 3개를 받았어요. 질문: 등급은요?")).toBeInTheDocument();
});

test("추천 질문을 누르면 바로 보내고, 로그인한 고객은 토큰을 붙여 내 렌탈도 물을 수 있다", async () => {
  renderAsCustomer("/my/rentals");
  const dialog = await openChat();
  await userEvent.click(within(dialog).getByRole("button", { name: "내 렌탈 검사 결과 알려 줘" }));
  expect(await within(dialog).findByText("[로그인] 대화 1개를 받았어요. 질문: 내 렌탈 검사 결과 알려 줘")).toBeInTheDocument();
  expect(within(dialog).queryByRole("list", { name: "이런 걸 물어보세요" })).not.toBeInTheDocument();
});

test("요청 제한과 서버 오류는 대화 안에 다시 보내라는 문장으로 알려 준다", async () => {
  renderApp("/guide");
  const dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "너무 많이{Enter}");
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("1분 뒤 다시 보내 주세요");
  await userEvent.type(within(dialog).getByLabelText("질문"), "고장{Enter}");
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("지금은 답할 수 없어요");
});

test("Esc나 닫기 버튼으로 닫으면 여는 버튼으로 돌아오고, 대화는 다시 열어도 남아 있다", async () => {
  renderApp("/guide");
  let dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "안녕{Enter}");
  await within(dialog).findByText(/질문: 안녕/);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "TRACE 도우미" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "TRACE 도우미 열기" })).toHaveFocus();
  dialog = await openChat();
  expect(within(dialog).getByText(/질문: 안녕/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "도우미 닫기" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("관리자 화면에는 도우미 버튼을 띄우지 않는다", async () => {
  renderAsAdmin("/admin/devices");
  expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "TRACE 도우미 열기" })).not.toBeInTheDocument();
});

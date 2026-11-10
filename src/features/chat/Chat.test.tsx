import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { http, HttpResponse } from "msw";
import { MOCK_ADMIN } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";

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

test("요청 제한과 서버 오류는 대화 안에 다시 보내라는 문장으로 알리고, 실패한 질문은 대화에서 빼 입력 칸에 돌려놓는다", async () => {
  renderApp("/guide");
  const dialog = await openChat();
  const input = within(dialog).getByLabelText("질문");
  const log = within(dialog).getByRole("list", { name: "대화" });
  await userEvent.type(input, "너무 많이{Enter}");
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("1분 뒤 다시 보내 주세요");
  expect(input).toHaveValue("너무 많이");
  expect(within(log).queryByText("너무 많이")).not.toBeInTheDocument();
  await userEvent.clear(input);
  await userEvent.type(input, "고장{Enter}");
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("지금은 답할 수 없어요");
  await userEvent.clear(input);
  await userEvent.type(input, "안녕{Enter}");
  expect(await within(log).findByText("대화 1개를 받았어요. 질문: 안녕")).toBeInTheDocument();
});

test("로그아웃하면 앞 계정의 대화를 지운다", async () => {
  const { router } = renderAsCustomer("/my/account");
  const dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "내 렌탈{Enter}");
  expect(await within(dialog).findByText(/\[로그인\] 대화 1개/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "도우미 닫기" }));
  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await vi.waitFor(() => expect(router.state.location.pathname).not.toBe("/my/account"));
  const reopened = await openChat();
  expect(within(reopened).queryByText(/\[로그인\]/)).not.toBeInTheDocument();
  expect(within(reopened).queryByText("내 렌탈")).not.toBeInTheDocument();
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

test("로그아웃 없이 다른 계정으로 로그인해도 앞 계정의 대화를 지운다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  const { router } = renderAsCustomer("/guide");
  const dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "내 렌탈{Enter}");
  expect(await within(dialog).findByText(/\[로그인\] 대화 1개/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "도우미 닫기" }));
  await router.navigate("/admin/login");
  await userEvent.type(await screen.findByLabelText("이메일"), MOCK_ADMIN.email);
  await userEvent.type(screen.getByLabelText("비밀번호"), MOCK_ADMIN.password);
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));
  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/admin/devices"));
  await router.navigate("/guide");
  const reopened = await openChat();
  expect(within(reopened).queryByText(/\[로그인\]/)).not.toBeInTheDocument();
  vi.unstubAllEnvs();
});

test("세션이 바뀌기 전에 보낸 질문의 답이 바뀐 뒤에 와도 새 대화에 붙이지 않는다", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let answered = false;
  server.use(
    http.post("*/api/v1/chat", async () => {
      await gate;
      answered = true;
      return HttpResponse.json({ reply: "앞 계정에게 보낼 늦은 답", provider: "gemini" });
    }),
  );
  const { router } = renderAsCustomer("/my/account");
  const dialog = await openChat();
  await userEvent.type(within(dialog).getByLabelText("질문"), "늦은 질문{Enter}");
  await userEvent.click(screen.getByRole("button", { name: "도우미 닫기" }));
  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await vi.waitFor(() => expect(router.state.location.pathname).not.toBe("/my/account"));
  release();
  await vi.waitFor(() => expect(answered).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const reopened = await openChat();
  expect(within(reopened).queryByText("앞 계정에게 보낼 늦은 답")).not.toBeInTheDocument();
  expect(within(reopened).queryByText("늦은 질문")).not.toBeInTheDocument();
  expect(within(reopened).getByLabelText("질문")).toHaveValue("");
});

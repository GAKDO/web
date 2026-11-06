import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db, MOCK_CUSTOMER, MOCK_RESET_CODE } from "../../shared/mocks/db";
import { tokenStore } from "../../shared/auth/tokenStore";
import { renderApp, renderAsCustomer } from "../../test/renderApp";

const NEW_PASSWORD = "example-new-pass-5678";

async function requestCode(email: string) {
  const user = userEvent.setup();
  renderApp("/password/reset");
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.click(screen.getByRole("button", { name: "코드 받기" }));
  await screen.findByLabelText("재설정 코드(6자리)");
  return user;
}

async function enter(user: ReturnType<typeof userEvent.setup>, code: string, password = NEW_PASSWORD, confirm = password) {
  await user.clear(screen.getByLabelText("재설정 코드(6자리)"));
  await user.type(screen.getByLabelText("재설정 코드(6자리)"), code);
  await user.type(screen.getByLabelText("새 비밀번호"), password);
  await user.type(screen.getByLabelText("새 비밀번호 확인"), confirm);
  await user.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
}

describe("비밀번호 재설정", () => {
  test("로그인 화면에서 재설정으로 가는 링크가 있다", async () => {
    renderApp("/login");
    expect(await screen.findByRole("link", { name: "비밀번호를 잊으셨나요?" })).toHaveAttribute("href", "/password/reset");
  });

  test("코드와 새 비밀번호를 넣으면 바뀌고, 새 비밀번호로 로그인할 수 있다", async () => {
    const user = await requestCode(MOCK_CUSTOMER.email);
    await enter(user, MOCK_RESET_CODE);
    expect(await screen.findByText(/비밀번호를 바꿨습니다/)).toBeInTheDocument();
    expect(db.accounts.find((a) => a.email === MOCK_CUSTOMER.email)?.password).toBe(NEW_PASSWORD);
    await user.click(screen.getByRole("link", { name: "새 비밀번호로 로그인" }));
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  });

  test("가입되지 않은 이메일도 같은 안내를 보여 계정이 있는지 드러내지 않는다", async () => {
    await requestCode("nobody@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("가입된 이메일이면 재설정 코드를 보냈습니다");
  });

  test("코드가 틀리면 남은 시도를 알리고, 다 쓰면 다시 받으라고 한다", async () => {
    const user = await requestCode(MOCK_CUSTOMER.email);
    await enter(user, "000000");
    expect(await screen.findByText("재설정 코드가 맞지 않습니다. 2번 더 시도할 수 있습니다.")).toBeInTheDocument();
    await enter(user, "000000");
    await enter(user, "000000");
    expect(await screen.findByText("시도 횟수를 다 썼습니다. 코드를 다시 받아 주세요.")).toBeInTheDocument();
    await enter(user, MOCK_RESET_CODE);
    expect(await screen.findByText("재설정 코드가 만료됐습니다. 코드를 다시 받아 주세요.")).toBeInTheDocument();
    // 다시 받으면 새 코드로 바꿀 수 있다
    await user.click(screen.getByRole("button", { name: "코드 다시 받기" }));
    await enter(user, MOCK_RESET_CODE);
    expect(await screen.findByText(/비밀번호를 바꿨습니다/)).toBeInTheDocument();
  });

  test("새 비밀번호 두 칸이 다르면 보내지 않는다", async () => {
    const user = await requestCode(MOCK_CUSTOMER.email);
    await enter(user, MOCK_RESET_CODE, NEW_PASSWORD, "different-pass");
    expect(await screen.findByText("새 비밀번호가 서로 다릅니다.")).toBeInTheDocument();
    // 칸을 고치면 이전 오류 문장이 사라진다
    await user.type(screen.getByLabelText("새 비밀번호 확인"), "x");
    expect(screen.queryByText("새 비밀번호가 서로 다릅니다.")).toBeNull();
    expect(db.accounts.find((a) => a.email === MOCK_CUSTOMER.email)?.password).toBe(MOCK_CUSTOMER.password);
  });
});

describe("계정 탈퇴", () => {
  test("내 정보 화면 아래 위험 구역에서 탈퇴 화면으로 갈 수 있다", async () => {
    renderAsCustomer("/my/account");
    expect(await screen.findByRole("link", { name: "계정 탈퇴" })).toHaveAttribute("href", "/my/account/withdraw");
  });

  test("비밀번호가 틀리면 세션을 끝내지 않고 칸 아래에 알린다", async () => {
    const user = userEvent.setup();
    const { router } = renderAsCustomer("/my/account/withdraw");
    await user.type(await screen.findByLabelText("비밀번호 확인"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "탈퇴" }));
    expect(await screen.findByText("비밀번호가 맞지 않습니다.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/my/account/withdraw");
    expect(tokenStore.get()).not.toBeNull();
    expect(db.accounts.some((a) => a.email === MOCK_CUSTOMER.email)).toBe(true);
  });

  test("한 번 더 묻고 취소하면 탈퇴하지 않는다", async () => {
    const user = userEvent.setup();
    renderAsCustomer("/my/account/withdraw");
    await user.type(await screen.findByLabelText("비밀번호 확인"), MOCK_CUSTOMER.password);
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(db.accounts.some((a) => a.email === MOCK_CUSTOMER.email)).toBe(true);
  });

  test("비밀번호를 확인하고 탈퇴하면 세션을 지우고 탈퇴 안내로 간다", async () => {
    const user = userEvent.setup();
    const { router } = renderAsCustomer("/my/account/withdraw");
    await user.type(await screen.findByLabelText("비밀번호 확인"), MOCK_CUSTOMER.password);
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "탈퇴" }));
    expect(await screen.findByRole("heading", { name: "탈퇴했습니다" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account/withdrawn");
    expect(tokenStore.get()).toBeNull();
    expect(db.accounts.some((a) => a.email === MOCK_CUSTOMER.email)).toBe(false);
  });
});

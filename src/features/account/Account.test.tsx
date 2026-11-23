// 이 파일이 확인하는 것: 고객 계정 관리. 메일 코드로 비밀번호를 다시 정하는 흐름과 계정 탈퇴 흐름.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db, MOCK_CUSTOMER, MOCK_RESET_CODE } from "../../shared/mocks/db";
import { tokenStore } from "../../shared/auth/tokenStore";
import { renderApp, renderAsCustomer } from "../../test/renderApp";

// 테스트 도구: 새 비밀번호로 쓸 시험용 값(실제 비밀번호 아님).
const NEW_PASSWORD = "example-new-pass-5678";

// 테스트 도구: 비밀번호 재설정 화면에서 이메일을 넣고 "코드 받기"를 눌러 코드 입력 칸이 나올 때까지 간다.
async function requestCode(email: string) {
  const user = userEvent.setup();
  renderApp("/password/reset");
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.click(screen.getByRole("button", { name: "코드 받기" }));
  await screen.findByLabelText("재설정 코드(6자리)");
  return user;
}

// 테스트 도구: 재설정 코드·새 비밀번호·확인 칸을 채우고 "비밀번호 바꾸기"를 누른다.
async function enter(user: ReturnType<typeof userEvent.setup>, code: string, password = NEW_PASSWORD, confirm = password) {
  await user.clear(screen.getByLabelText("재설정 코드(6자리)"));
  await user.type(screen.getByLabelText("재설정 코드(6자리)"), code);
  await user.type(screen.getByLabelText("새 비밀번호"), password);
  await user.type(screen.getByLabelText("새 비밀번호 확인"), confirm);
  await user.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
}

// 테스트 묶음: 비밀번호를 잊었을 때 메일로 받은 6자리 코드로 새 비밀번호를 정하는 흐름.
describe("비밀번호 재설정", () => {
  // [상황] 로그인 화면을 연다.
  // [기대] "비밀번호를 잊으셨나요?" 링크가 재설정 화면으로 간다.
  test("로그인 화면에서 재설정으로 가는 링크가 있다", async () => {
    renderApp("/login");
    expect(await screen.findByRole("link", { name: "비밀번호를 잊으셨나요?" })).toHaveAttribute("href", "/password/reset");
  });

  // [상황] 맞는 재설정 코드와 새 비밀번호를 넣는다.
  // [기대] "비밀번호를 바꿨습니다"가 보이고 계정 비밀번호가 바뀐다. "새 비밀번호로 로그인"을 누르면 로그인 화면으로 간다.
  test("코드와 새 비밀번호를 넣으면 바뀌고, 새 비밀번호로 로그인할 수 있다", async () => {
    const user = await requestCode(MOCK_CUSTOMER.email);
    await enter(user, MOCK_RESET_CODE);
    expect(await screen.findByText(/비밀번호를 바꿨습니다/)).toBeInTheDocument();
    expect(db.accounts.find((a) => a.email === MOCK_CUSTOMER.email)?.password).toBe(NEW_PASSWORD);
    await user.click(screen.getByRole("link", { name: "새 비밀번호로 로그인" }));
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  });

  // [상황] 가입되지 않은 이메일로 코드를 요청한다.
  // [기대] 가입된 이메일과 똑같이 "가입된 이메일이면 재설정 코드를 보냈습니다"가 보인다(남이 가입 여부를 알아내지 못하게).
  test("가입되지 않은 이메일도 같은 안내를 보여 계정이 있는지 드러내지 않는다", async () => {
    await requestCode("nobody@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("가입된 이메일이면 재설정 코드를 보냈습니다");
  });

  // [상황] 틀린 코드를 세 번 넣고, 그 뒤 맞는 코드를 넣어 보고, 코드를 다시 받아 넣는다.
  // [기대] 처음엔 "2번 더 시도할 수 있습니다", 세 번째엔 "시도 횟수를 다 썼습니다", 그 뒤엔 맞는 코드라도 "만료됐습니다"가 된다.
  //        코드를 다시 받으면 새 코드로 바꿀 수 있다(무작정 맞혀 보기 방지).
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

  // [상황] 새 비밀번호와 확인 칸을 다르게 넣었다가, 확인 칸을 고친다.
  // [기대] "새 비밀번호가 서로 다릅니다."가 보이고 서버에 보내지 않아 비밀번호는 그대로다. 칸을 고치면 오류 문장이 사라진다.
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

// 테스트 묶음: 고객이 스스로 계정을 지우는 흐름. 본인 확인 → 한 번 더 묻기 → 탈퇴 순서다.
describe("계정 탈퇴", () => {
  // [상황] 고객이 내 정보 화면을 연다.
  // [기대] 아래쪽에 탈퇴 화면으로 가는 "탈퇴하기" 링크가 있다.
  test("내 정보 화면 아래 위험 구역에서 탈퇴 화면으로 갈 수 있다", async () => {
    renderAsCustomer("/my/account");
    expect(await screen.findByRole("link", { name: "탈퇴하기" })).toHaveAttribute("href", "/my/account/withdraw");
  });

  // [상황] 탈퇴 화면에서 틀린 비밀번호를 넣고 탈퇴를 확인한다.
  // [기대] "비밀번호가 맞지 않습니다."가 칸 아래 보이고, 탈퇴 화면에 머물며 로그인과 계정이 그대로다.
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

  // [상황] 구글로만 가입해 비밀번호가 없는 고객이 탈퇴 화면을 연다. "탈퇴 안"을 넣었다가 "탈퇴"로 고쳐 진행한다.
  // [기대] 비밀번호 칸 대신 "탈퇴"를 입력하는 칸이 나오고, 정확히 "탈퇴"일 때만 버튼이 눌린다. 탈퇴하면 "탈퇴했습니다" 화면으로 간다.
  test("비밀번호를 정한 적 없는 소셜 가입 계정은 비밀번호 대신 '탈퇴'를 입력해 탈퇴한다", async () => {
    const customer = db.accounts.find((a) => a.email === MOCK_CUSTOMER.email);
    if (customer) {
      customer.socialProviders = ["GOOGLE"];
      customer.passwordSet = false;
    }
    const user = userEvent.setup();
    const { router } = renderAsCustomer("/my/account/withdraw");
    const input = await screen.findByLabelText('확인을 위해 "탈퇴" 입력');
    expect(screen.queryByLabelText("비밀번호 확인")).not.toBeInTheDocument();
    await user.type(input, "탈퇴 안");
    expect(screen.getByRole("button", { name: "탈퇴하기" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "탈퇴");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "탈퇴" }));
    expect(await screen.findByRole("heading", { name: "탈퇴했습니다" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account/withdrawn");
  });

  // [상황] 비밀번호로 가입한 뒤 구글을 연결한 고객이 탈퇴 화면을 연다.
  // [기대] 계속 비밀번호를 묻고 "탈퇴" 입력 칸은 없다.
  test("비밀번호로 가입한 뒤 소셜이 연결된 계정은 계속 비밀번호를 묻는다", async () => {
    const customer = db.accounts.find((a) => a.email === MOCK_CUSTOMER.email);
    if (customer) customer.socialProviders = ["GOOGLE"];
    renderAsCustomer("/my/account/withdraw");
    expect(await screen.findByLabelText("비밀번호 확인")).toBeInTheDocument();
    expect(screen.queryByLabelText('확인을 위해 "탈퇴" 입력')).not.toBeInTheDocument();
  });

  // [상황] 비밀번호 없는 소셜 계정인데 로그인한 지 10분이 지나, 서버가 다시 로그인하라고(REAUTH_REQUIRED) 답한다.
  // [기대] 탈퇴하지 않고 "다시 로그인한 뒤 탈퇴해 주세요"가 보인다. "다시 로그인"을 누르면 로그인 뒤 탈퇴 화면으로 돌아오도록 로그인 화면으로 간다.
  //        (비밀번호가 없으니 최근 로그인으로 본인을 확인하는 것)
  test("로그인한 지 10분이 지나 서버가 REAUTH_REQUIRED를 주면 탈퇴하지 않고 다시 로그인하게 안내한다", async () => {
    const customer = db.accounts.find((a) => a.email === MOCK_CUSTOMER.email);
    if (customer) {
      customer.passwordSet = false;
      customer.staleLogin = true;
    }
    const user = userEvent.setup();
    const { router } = renderAsCustomer("/my/account/withdraw");
    await user.type(await screen.findByLabelText('확인을 위해 "탈퇴" 입력'), "탈퇴");
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "탈퇴" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인한 뒤 탈퇴해 주세요");
    expect(db.accounts.some((a) => a.email === MOCK_CUSTOMER.email)).toBe(true);
    await user.click(screen.getByRole("button", { name: "다시 로그인" }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toContain("next=%2Fmy%2Faccount%2Fwithdraw");
  });

  // [상황] 맞는 비밀번호를 넣고 "탈퇴하기"를 누른 뒤, 확인 창에서 "취소"를 누른다.
  // [기대] 확인 창이 닫히고 계정은 그대로다.
  test("한 번 더 묻고 취소하면 탈퇴하지 않는다", async () => {
    const user = userEvent.setup();
    renderAsCustomer("/my/account/withdraw");
    await user.type(await screen.findByLabelText("비밀번호 확인"), MOCK_CUSTOMER.password);
    await user.click(screen.getByRole("button", { name: "탈퇴하기" }));
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(db.accounts.some((a) => a.email === MOCK_CUSTOMER.email)).toBe(true);
  });

  // [상황] 맞는 비밀번호를 넣고 확인 창에서 "탈퇴"를 누른다.
  // [기대] "탈퇴했습니다" 화면으로 가고, 로그인 정보가 지워지며, 계정이 없어진다.
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

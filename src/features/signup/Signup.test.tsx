// 이 파일이 확인하는 것: 고객 회원가입과 메일 인증. 이름·이메일·비밀번호를 넣고 개인정보 동의 뒤 가입하면,
// 메일로 받은 6자리 코드로 인증한다. QR로 들어온 고객은 인증이 끝나면 바로 로그인돼 원래 화면으로 돌아간다.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders, createQueryClient } from "../../AppProviders";
import { routes } from "../../App";
import { CustomerLoginPage } from "../customer-auth/components/CustomerLoginPage";
import { RequireCustomer } from "../../shared/auth/RequireCustomer";
import { demoCustomerEmails } from "../../shared/config/demoAccounts";
import { MOCK_CUSTOMER, MOCK_EMAIL_CODE, db } from "../../shared/mocks/db";
import { pendingSignup } from "./pendingSignup";

// 테스트 도구: 테스트마다 가입 중 잠깐 기억하는 값(자동 로그인용)을 비운다.
beforeEach(() => pendingSignup.clear());

// 테스트 도구: 처음 가입하는 고객의 이름·이메일·시험용 비밀번호(실제 비밀번호 아님).
const NEW = { name: "홍길동", email: "new-renter@example.com", password: "example-pass-5678" };

// 테스트 도구: 실제 앱 화면 목록에 로그인이 필요한 가짜 "촬영 화면"(/qr)을 더해 원하는 주소로 연다.
function renderAt(path: string, extra = routes) {
  const router = createMemoryRouter(
    [...extra, { path: "/qr", element: <RequireCustomer />, children: [{ index: true, element: <p>촬영 화면</p> }] }],
    { initialEntries: [path] },
  );
  render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

// 테스트 도구: 가입 화면에 이름·이메일·비밀번호를 넣고, 원하면 개인정보 동의에 체크한다.
async function fillSignup(user: ReturnType<typeof userEvent.setup>, agree = true) {
  await user.type(await screen.findByLabelText("이름"), NEW.name);
  await user.type(screen.getByLabelText("이메일"), NEW.email);
  await user.type(screen.getByLabelText("비밀번호"), NEW.password);
  if (agree) await user.click(screen.getByRole("checkbox"));
}

// [상황] QR(/qr?t=abc)로 들어온 새 고객이 로그인 화면에서 회원가입을 누르고, 가입한 뒤 메일 코드를 넣는다.
// [기대] 그 이메일로 6자리 코드를 보냈다는 안내가 보이고, 인증하면 바로 로그인돼 촬영 화면(?t=abc 그대로)으로 돌아온다.
//        자동 로그인에 쓴 비밀번호는 메모리에서도 지운다.
test("QR로 들어온 새 고객은 로그인 화면에서 가입하고 메일 인증을 마치면 바로 로그인돼 촬영 화면으로 돌아온다", async () => {
  const user = userEvent.setup();
  const router = renderAt("/qr?t=abc");
  await user.click(await screen.findByRole("link", { name: "회원가입" }));
  await fillSignup(user);
  await user.click(screen.getByRole("button", { name: "가입하고 인증 코드 받기" }));
  expect(await screen.findByText(`${NEW.email}로 보낸 6자리 코드를 입력해 주세요.`)).toBeInTheDocument();
  await user.type(screen.getByLabelText("인증 코드"), MOCK_EMAIL_CODE);
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  expect(await screen.findByText("촬영 화면")).toBeInTheDocument();
  expect(router.state.location.search).toBe("?t=abc");
  // 비밀번호는 자동 로그인 뒤 메모리에서도 지운다
  expect(pendingSignup.takePassword()).toBeNull();
});

// [상황] 인증 화면 주소를 새로 연다.
// [기대] 이메일 칸이 비어 있고 직접 넣으라는 안내가 보인다(주소에 이메일을 싣지 않아 남에게 새지 않게).
test("새로 연 인증 화면은 이메일을 주소에서 읽지 않고 직접 입력받는다", async () => {
  renderAt("/signup/verify?next=/qr");
  expect(await screen.findByLabelText("이메일")).toHaveValue("");
  expect(screen.getByText("가입한 이메일과 메일로 받은 6자리 코드를 입력해 주세요.")).toBeInTheDocument();
});

// [상황] 가입 칸은 다 채웠지만 개인정보 동의에 체크하지 않는다.
// [기대] "가입하고 인증 코드 받기" 버튼이 눌리지 않는다.
test("개인정보 동의 전에는 가입 버튼이 눌리지 않는다", async () => {
  const user = userEvent.setup();
  renderAt("/signup");
  await fillSignup(user, false);
  expect(screen.getByRole("button", { name: "가입하고 인증 코드 받기" })).toBeDisabled();
});

// [상황] 이미 가입된 이메일로 가입하려 한다.
// [기대] "이미 가입된 이메일입니다."와 "로그인하기" 링크가 보인다. 링크 주소에 이메일이 실리지 않지만, 눌러 가면 이메일 칸이 채워져 있다.
test("이미 가입된 이메일이면 알려 주고 로그인 링크를 보인다", async () => {
  const user = userEvent.setup();
  renderAt("/signup?next=/qr");
  await user.type(await screen.findByLabelText("이름"), "고객");
  await user.type(screen.getByLabelText("이메일"), MOCK_CUSTOMER.email);
  await user.type(screen.getByLabelText("비밀번호"), MOCK_CUSTOMER.password);
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "가입하고 인증 코드 받기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 가입된 이메일입니다.");
  const link = screen.getByRole("link", { name: "로그인하기" });
  expect(link.getAttribute("href")).not.toContain("renter");
  await user.click(link);
  expect(await screen.findByLabelText("이메일")).toHaveValue(MOCK_CUSTOMER.email);
});

// [상황] 메일 코드를 틀리게 넣은 뒤 "코드 다시 받기"를 누른다.
// [기대] "인증 코드가 맞지 않습니다."가 보이고, 다시 받기를 누르면 "다시 보냈습니다"가 보인다.
test("코드가 틀리면 오류를 보이고, 코드는 다시 받을 수 있다", async () => {
  const user = userEvent.setup();
  renderAt("/signup?next=/qr");
  await fillSignup(user);
  await user.click(screen.getByRole("button", { name: "가입하고 인증 코드 받기" }));
  await user.type(await screen.findByLabelText("인증 코드"), "000000");
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("인증 코드가 맞지 않습니다.");
  await user.click(screen.getByRole("button", { name: "코드 다시 받기" }));
  expect(await screen.findByRole("status")).toHaveTextContent("다시 보냈습니다");
});

// [상황] 가입만 하고 메일 인증을 안 한 계정으로 로그인한 뒤, "메일 인증하러 가기"로 가서 인증한다.
// [기대] "이메일 인증이 끝나지 않은 계정입니다."가 보이고, 인증을 마치면 로그인 화면으로 돌아와 이메일이 채워져 있다.
test("인증 전 계정으로 로그인하면 인증하러 가는 링크를 보이고, 인증을 마치면 로그인 화면으로 돌아와 이메일이 채워져 있다", async () => {
  db.accounts.push({ accountId: "pendingAccount0000001", email: NEW.email, password: NEW.password, role: "CUSTOMER", pending: true });
  const user = userEvent.setup();
  const router = renderAt("/login?next=/qr");
  await user.type(await screen.findByLabelText("이메일"), NEW.email);
  await user.type(screen.getByLabelText("비밀번호"), NEW.password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 인증이 끝나지 않은 계정입니다.");
  await user.click(screen.getByRole("link", { name: "메일 인증하러 가기" }));
  await user.type(await screen.findByLabelText("인증 코드"), MOCK_EMAIL_CODE);
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  expect(await screen.findByText("메일 인증이 끝났습니다. 로그인해 주세요.")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
  expect(screen.getByLabelText("이메일")).toHaveValue(NEW.email);
});

// [상황] 시연용 계정 목록이 있는 로그인 화면에서 시연 이메일을 누른다.
// [기대] 이메일 칸만 채워지고 비밀번호는 채우지 않는다(비밀번호를 화면에 두지 않음).
test("시연용 계정 이메일을 누르면 로그인 이메일 칸이 채워진다(비밀번호는 채우지 않는다)", async () => {
  const user = userEvent.setup();
  const withDemo = routes.map((r) => (r.path === "/login" ? { ...r, element: <CustomerLoginPage demoEmails={["demo1@example.com"]} /> } : r));
  renderAt("/login", withDemo);
  await user.click(await screen.findByRole("button", { name: "demo1@example.com" }));
  expect(screen.getByLabelText("이메일")).toHaveValue("demo1@example.com");
  expect(screen.getByLabelText("비밀번호")).toHaveValue("");
});

// [상황] 시연용 계정 목록 설정 값에 빈칸·이메일 아닌 글자·중복이 섞여 있다.
// [기대] 쉼표로 나눠 이메일 모양만, 중복 없이 남긴다.
test("시연용 계정 환경 변수는 쉼표로 나누고 이메일 모양만 남긴다", () => {
  expect(demoCustomerEmails("")).toEqual([]);
  expect(demoCustomerEmails(" a@example.com, ,not-email,a@example.com,b@example.com ")).toEqual(["a@example.com", "b@example.com"]);
});

// [상황] 메일 인증 코드를 한 번 틀린다.
// [기대] "인증 코드가 맞지 않습니다. 4번 더 시도할 수 있습니다."가 보인다(무작정 맞혀 보기 방지로 횟수 제한).
test("메일 인증 코드를 틀리면 남은 시도 횟수를 알려 준다", async () => {
  const user = userEvent.setup();
  renderAt("/signup");
  await fillSignup(user);
  await user.click(screen.getByRole("button", { name: "가입하고 인증 코드 받기" }));
  await user.type(await screen.findByLabelText("인증 코드"), "000000");
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  expect(await screen.findByText("인증 코드가 맞지 않습니다. 4번 더 시도할 수 있습니다.")).toBeInTheDocument();
});

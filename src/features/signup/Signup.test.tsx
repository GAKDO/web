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

beforeEach(() => pendingSignup.clear());

const NEW = { name: "홍길동", email: "new-renter@example.com", password: "example-pass-5678" };

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

async function fillSignup(user: ReturnType<typeof userEvent.setup>, agree = true) {
  await user.type(await screen.findByLabelText("이름"), NEW.name);
  await user.type(screen.getByLabelText("이메일"), NEW.email);
  await user.type(screen.getByLabelText("비밀번호"), NEW.password);
  if (agree) await user.click(screen.getByRole("checkbox"));
}

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

test("새로 연 인증 화면은 이메일을 주소에서 읽지 않고 직접 입력받는다", async () => {
  renderAt("/signup/verify?next=/qr");
  expect(await screen.findByLabelText("이메일")).toHaveValue("");
  expect(screen.getByText("가입한 이메일과 메일로 받은 6자리 코드를 입력해 주세요.")).toBeInTheDocument();
});

test("개인정보 동의 전에는 가입 버튼이 눌리지 않는다", async () => {
  const user = userEvent.setup();
  renderAt("/signup");
  await fillSignup(user, false);
  expect(screen.getByRole("button", { name: "가입하고 인증 코드 받기" })).toBeDisabled();
});

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

test("시연용 계정 이메일을 누르면 로그인 이메일 칸이 채워진다(비밀번호는 채우지 않는다)", async () => {
  const user = userEvent.setup();
  const withDemo = routes.map((r) => (r.path === "/login" ? { ...r, element: <CustomerLoginPage demoEmails={["demo1@example.com"]} /> } : r));
  renderAt("/login", withDemo);
  await user.click(await screen.findByRole("button", { name: "demo1@example.com" }));
  expect(screen.getByLabelText("이메일")).toHaveValue("demo1@example.com");
  expect(screen.getByLabelText("비밀번호")).toHaveValue("");
});

test("시연용 계정 환경 변수는 쉼표로 나누고 이메일 모양만 남긴다", () => {
  expect(demoCustomerEmails("")).toEqual([]);
  expect(demoCustomerEmails(" a@example.com, ,not-email,a@example.com,b@example.com ")).toEqual(["a@example.com", "b@example.com"]);
});

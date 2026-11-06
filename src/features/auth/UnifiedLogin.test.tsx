import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import { MOCK_ADMIN, MOCK_CUSTOMER } from "../../shared/mocks/db";

afterEach(() => vi.unstubAllEnvs());

const ACCOUNT_ON = "phoneCapture,diagnostics,report,pilot";

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.type(screen.getByLabelText("비밀번호"), password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
}

test("고객 계정을 보이는 배포에서 로그인 화면에 관리자 계정을 넣으면 관리자 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const { router } = renderApp("/admin/login");
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  await signIn(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("link", { name: "기기" });
  expect(router.state.location.pathname).toBe("/admin/devices");
});

test("같은 로그인 화면에 고객 계정을 넣으면 내 계정 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  const { router } = renderApp("/admin/login");
  await signIn(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByRole("heading", { name: "내 계정" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/my/account");
});

test("고객 계정을 숨긴 MVP 배포에서는 관리자 로그인 그대로이고 고객 계정은 들어가지 못한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,account,pilot");
  const { router } = renderApp("/admin/login");
  expect(await screen.findByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
  await signIn(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByRole("status")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/login");
});

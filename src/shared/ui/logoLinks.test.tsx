import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";

// 어느 화면에서든 TRACE 로고를 누르면 첫 화면(/)으로 간다(11/6 사용자 요청)

afterEach(() => vi.unstubAllEnvs());

test.each(["/admin/login", "/login", "/signup", "/signup/verify", "/password/reset"])("로그인 전 화면 %s의 로고는 첫 화면으로 간다", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp(path);
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

test.each(["/my/account", "/my/rentals", "/my/account/withdraw"])("고객 화면 %s 맨 위에 첫 화면으로 가는 로고가 있다", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderAsCustomer(path);
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/my/account");
});

test("검증 화면에도 첫 화면으로 가는 로고가 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/verify/abc");
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

test("고객이 로고를 눌러 첫 화면에 오면 위쪽 버튼으로 내 화면에 돌아간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const user = userEvent.setup();
  renderAsCustomer("/my/account");
  await user.click(await screen.findByRole("link", { name: "TRACE 첫 화면" }));
  const back = await screen.findByRole("link", { name: "마이페이지" });
  expect(back).toHaveAttribute("href", "/my/rentals");
  expect(screen.queryByRole("link", { name: "회원가입" })).not.toBeInTheDocument();
});

test("관리자 화면 로고도 첫 화면으로 간다", async () => {
  renderAsAdmin("/admin/devices");
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

test.each(["/my/account", "/my/account/withdraw"])("관리자가 로그인한 채 %s를 열면 관리자 화면으로 간다(관리자 계정을 고객 탈퇴로 지우지 않게)", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const { router } = renderAsAdmin(path);
  await screen.findByRole("heading", { level: 1, name: /기기/ });
  expect(router.state.location.pathname).toBe("/admin/devices");
});

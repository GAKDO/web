// 이 파일이 확인하는 것: 어느 화면에서든 TRACE 로고를 누르면 첫 화면(/)으로 가는지(11/6 사용자 요청), 그리고 관리자가 고객 화면에 들어왔을 때의 처리.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";

// 어느 화면에서든 TRACE 로고를 누르면 첫 화면(/)으로 간다(11/6 사용자 요청)

afterEach(() => vi.unstubAllEnvs());

// [상황] 로그인 전 화면들(관리자 로그인, 로그인, 회원가입, 이메일 확인, 비밀번호 재설정)을 연다.
// [기대] 로고가 첫 화면으로 가는 링크다.
test.each(["/admin/login", "/login", "/signup", "/signup/verify", "/password/reset"])("로그인 전 화면 %s의 로고는 첫 화면으로 간다", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp(path);
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

// [상황] 고객으로 내 정보·마이페이지·탈퇴 화면을 연다.
// [기대] 맨 위에 첫 화면으로 가는 로고와 "내 정보" 링크가 있다.
test.each(["/my/account", "/my/rentals", "/my/account/withdraw"])("고객 화면 %s 맨 위에 첫 화면으로 가는 로고가 있다", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderAsCustomer(path);
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/my/account");
});

// [상황] 공개 검증 화면을 연다.
// [기대] 첫 화면으로 가는 로고가 있다.
test("검증 화면에도 첫 화면으로 가는 로고가 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/verify/abc");
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

// [상황] 고객이 내 정보에서 로고를 눌러 첫 화면으로 간다.
// [기대] 첫 화면 위쪽에 "마이페이지" 버튼이 있어 돌아갈 수 있고, 이미 로그인했으니 "회원가입"은 보이지 않는다.
test("고객이 로고를 눌러 첫 화면에 오면 위쪽 버튼으로 내 화면에 돌아간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const user = userEvent.setup();
  renderAsCustomer("/my/account");
  await user.click(await screen.findByRole("link", { name: "TRACE 첫 화면" }));
  const back = await screen.findByRole("link", { name: "마이페이지" });
  expect(back).toHaveAttribute("href", "/my/rentals");
  expect(screen.queryByRole("link", { name: "회원가입" })).not.toBeInTheDocument();
});

// [상황] 관리자 기기 화면을 연다.
// [기대] 로고가 첫 화면으로 가는 링크다.
test("관리자 화면 로고도 첫 화면으로 간다", async () => {
  renderAsAdmin("/admin/devices");
  expect(await screen.findByRole("link", { name: "TRACE 첫 화면" })).toHaveAttribute("href", "/");
});

// [상황] 관리자로 로그인한 채 고객용 내 정보·탈퇴 화면 주소를 연다.
// [기대] 관리자 화면(기기 목록)으로 보낸다(관리자 계정을 고객 탈퇴 화면에서 실수로 지우지 않게).
test.each(["/my/account", "/my/account/withdraw"])("관리자가 로그인한 채 %s를 열면 관리자 화면으로 간다(관리자 계정을 고객 탈퇴로 지우지 않게)", async (path) => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const { router } = renderAsAdmin(path);
  await screen.findByRole("heading", { level: 1, name: /기기/ });
  expect(router.state.location.pathname).toBe("/admin/devices");
});

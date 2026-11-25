// 이 파일이 확인하는 것: 고객 로그인과 "로그인해야 볼 수 있는 고객 화면" 보호.
// 로그인하지 않고 고객 화면을 열면 로그인으로 보냈다가 로그인 뒤 원래 화면으로 되돌려 준다.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders, createQueryClient } from "../../AppProviders";
import { routes } from "../../App";
import { RequireCustomer } from "../../shared/auth/RequireCustomer";
import { captureTokenStore } from "../../shared/auth/captureTokenStore";
import { MOCK_ADMIN, MOCK_CUSTOMER } from "../../shared/mocks/db";
import { safeNext } from "./safeNext";

// 고객 화면 하나를 흉내 낸 라우트를 더해 가드·로그인 왕복을 본다
// 테스트 도구: 실제 앱 화면 목록에 "내 화면"이라는 가짜 고객 화면(/my, 로그인 필요)을 더해 원하는 주소로 연다.
function renderWithCustomerRoute(path: string) {
  const router = createMemoryRouter(
    [...routes, { path: "/my", element: <RequireCustomer />, children: [{ index: true, element: <p>내 화면</p> }] }],
    { initialEntries: [path] },
  );
  render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

// 테스트 도구: 로그인 화면에 이메일·비밀번호를 넣고 "로그인"을 누른다.
async function login(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.type(screen.getByLabelText("비밀번호"), password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
}

// [상황] 로그인하지 않고 고객 화면(/my?x=1)을 연 뒤 고객 계정으로 로그인한다.
// [기대] 로그인 화면으로 가면서 돌아갈 주소가 next로 실리고, 로그인하면 원래 화면(/my?x=1)으로 돌아온다.
test("로그인하지 않은 고객이 고객 화면을 열면 로그인 화면으로 가고, 로그인하면 그 화면으로 돌아온다", async () => {
  const router = renderWithCustomerRoute("/my?x=1");
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/my?x=1")}`);
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByText("내 화면")).toBeInTheDocument();
  expect(router.state.location.search).toBe("?x=1");
});

// [상황] 관리자 계정으로 고객 화면에 로그인한다.
// [기대] 고객 화면이 열린다(관리자도 고객 화면을 볼 수 있음).
test("관리자 계정으로도 고객 화면에 들어올 수 있다", async () => {
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_ADMIN.email, MOCK_ADMIN.password);
  expect(await screen.findByText("내 화면")).toBeInTheDocument();
});

// [상황] 고객으로 로그인한 뒤 관리 화면 주소를 연다.
// [기대] "관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요."가 보인다.
test("고객으로 로그인한 뒤 관리 화면을 열면 관리자 로그인 화면이 관리자 전용이라고 알린다", async () => {
  const router = renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  await screen.findByText("내 화면");
  await router.navigate("/admin/devices");
  expect(await screen.findByText("관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요.")).toBeInTheDocument();
});

// [상황] 고객 계정의 비밀번호를 틀리게 넣는다.
// [기대] "이메일 또는 비밀번호가 맞지 않습니다"가 보이고 고객 화면으로 가지 않는다.
test("틀린 비밀번호면 문장이 보이고 고객 화면으로 가지 않는다", async () => {
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, "wrong-password");
  expect(await screen.findByText(/이메일 또는 비밀번호가 맞지 않습니다/)).toBeInTheDocument();
  expect(screen.queryByText("내 화면")).not.toBeInTheDocument();
});

// [상황] 로그인 뒤 돌아갈 주소(next)에 외부 사이트 주소나 그 변형(//, /\)을 넣는다.
// [기대] 따르지 않고 첫 화면(/)으로 보낸다. 사이트 안 주소(/capture?t=…)는 그대로 따른다(로그인 뒤 가짜 사이트로 빼돌리는 공격 방지).
test("next가 외부 주소면 따르지 않는다", () => {
  expect(safeNext("https://evil.example.com")).toBe("/");
  expect(safeNext("//evil.example.com")).toBe("/");
  expect(safeNext("/\\evil.example.com")).toBe("/");
  expect(safeNext(null)).toBe("/");
  expect(safeNext("/capture?t=abc")).toBe("/capture?t=abc");
});

// [상황] 이전 계정의 폰 촬영 권한이 남은 브라우저에서 고객으로 로그인한다.
// [기대] 이전 촬영 권한이 지워진다(다른 사람의 렌탈로 사진을 올리지 않게).
test("로그인하면 이전 계정의 촬영 권한이 지워진다", async () => {
  captureTokenStore.set({ accessToken: "cap.old", tokenType: "Bearer", expiresIn: 1800, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  await screen.findByText("내 화면");
  expect(captureTokenStore.get()).toBeNull();
});

// [상황] 고객으로 로그인한 채 관리자 로그인 화면에서 관리자 비밀번호를 틀린다.
// [기대] 오류만 보이고, 고객 화면으로 돌아가면 고객 로그인이 그대로 살아 있다.
test("고객으로 로그인한 채 관리자 로그인에서 비밀번호를 틀려도 고객 세션은 끝나지 않는다", async () => {
  const router = renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  await screen.findByText("내 화면");
  await router.navigate("/admin/login");
  await login(MOCK_ADMIN.email, "wrong-password");
  expect(await screen.findByText(/이메일 또는 비밀번호가 맞지 않습니다/)).toBeInTheDocument();
  await router.navigate("/my");
  expect(await screen.findByText("내 화면")).toBeInTheDocument();
});

// [상황] 돌아갈 주소 없이 관리자 계정으로 로그인한다.
// [기대] 관리 화면의 기기 목록(/admin/devices)으로 간다.
test("next 없이 관리자 계정으로 로그인하면 관리자 화면으로 간다", async () => {
  const router = renderWithCustomerRoute("/login");
  await login(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("heading", { name: /기기/ });
  expect(router.state.location.pathname).toBe("/admin/devices");
});

// [상황] 고객 로그인 화면을 연다.
// [기대] "이메일로 회원가입" 링크가 돌아갈 주소를 이어서 갖고 있고, 아래쪽에 따로 "관리자 로그인" 링크는 없다(한 화면에서 둘 다 로그인).
test("로그인 화면에 회원가입 버튼이 있고, 관리자도 같은 화면에서 로그인하므로 따로 관리자 로그인 링크를 두지 않는다", async () => {
  renderWithCustomerRoute("/login?next=/my");
  await screen.findByRole("heading", { name: "로그인" });
  expect(screen.getByRole("link", { name: "이메일로 회원가입" })).toHaveAttribute("href", `/signup?next=${encodeURIComponent("/my")}`);
  expect(within(screen.getByRole("contentinfo")).queryByRole("link", { name: "관리자 로그인" })).not.toBeInTheDocument();
});

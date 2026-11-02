import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders, createQueryClient } from "../../AppProviders";
import { routes } from "../../App";
import { RequireCustomer } from "../../shared/auth/RequireCustomer";
import { captureTokenStore } from "../../shared/auth/captureTokenStore";
import { MOCK_ADMIN, MOCK_CUSTOMER } from "../../shared/mocks/db";
import { safeNext } from "./safeNext";

// 고객 화면 하나를 흉내 낸 라우트를 더해 가드·로그인 왕복을 본다
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

async function login(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.type(screen.getByLabelText("비밀번호"), password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
}

test("로그인하지 않은 고객이 고객 화면을 열면 로그인 화면으로 가고, 로그인하면 그 화면으로 돌아온다", async () => {
  const router = renderWithCustomerRoute("/my?x=1");
  expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
  expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/my?x=1")}`);
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByText("내 화면")).toBeInTheDocument();
  expect(router.state.location.search).toBe("?x=1");
});

test("관리자 계정으로도 고객 화면에 들어올 수 있다", async () => {
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_ADMIN.email, MOCK_ADMIN.password);
  expect(await screen.findByText("내 화면")).toBeInTheDocument();
});

test("고객으로 로그인한 뒤 관리 화면을 열면 관리자 로그인 화면이 관리자 전용이라고 알린다", async () => {
  const router = renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  await screen.findByText("내 화면");
  await router.navigate("/admin/devices");
  expect(await screen.findByText("관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요.")).toBeInTheDocument();
});

test("틀린 비밀번호면 문장이 보이고 고객 화면으로 가지 않는다", async () => {
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, "wrong-password");
  expect(await screen.findByText(/이메일 또는 비밀번호가 맞지 않습니다/)).toBeInTheDocument();
  expect(screen.queryByText("내 화면")).not.toBeInTheDocument();
});

test("next가 외부 주소면 따르지 않는다", () => {
  expect(safeNext("https://evil.example.com")).toBe("/");
  expect(safeNext("//evil.example.com")).toBe("/");
  expect(safeNext("/\\evil.example.com")).toBe("/");
  expect(safeNext(null)).toBe("/");
  expect(safeNext("/capture?t=abc")).toBe("/capture?t=abc");
});

test("로그인하면 이전 계정의 촬영 권한이 지워진다", async () => {
  captureTokenStore.set({ accessToken: "cap.old", tokenType: "Bearer", expiresIn: 1800, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderWithCustomerRoute("/login?next=/my");
  await login(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  await screen.findByText("내 화면");
  expect(captureTokenStore.get()).toBeNull();
});

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

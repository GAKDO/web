import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { renderApp } from "../../test/renderApp";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";
import { MOCK_ADMIN, MOCK_CUSTOMER, db, expireAccessTokens } from "../../shared/mocks/db";
import { api, unwrap } from "../../shared/api/client";
import { tokenStore } from "../../shared/auth/tokenStore";

// 이 파일은 관리자 전용 로그인(고객 계정 숨김, MVP 배포)을 본다. 통합 로그인은 UnifiedLogin.test.tsx
beforeEach(() => vi.stubEnv("VITE_ARCHIVED_FEATURES", "account"));
afterEach(() => vi.unstubAllEnvs());

async function loginAs(email: string, password: string) {
  const user = userEvent.setup();
  const { router } = renderApp("/admin/login");
  await user.type(await screen.findByLabelText("이메일"), email);
  await user.type(screen.getByLabelText("비밀번호"), password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  return { user, router };
}

test("올바른 관리자 이메일·비밀번호로 로그인하면 기기 목록 화면이 열린다", async () => {
  await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  expect(await screen.findByRole("heading", { name: "기기 목록" })).toBeInTheDocument();
});

test("틀린 비밀번호로 로그인하면 문장이 보이고 비밀번호 칸만 비워진다", async () => {
  await loginAs(MOCK_ADMIN.email, "wrong-password");
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호가 맞지 않습니다");
  expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  expect(screen.getByLabelText("이메일")).toHaveValue(MOCK_ADMIN.email);
});

test("로그인 시도가 잦아 서버가 거절하면(429) 잠시 뒤 다시 시도하라는 문장이 보인다", async () => {
  server.use(http.post("*/api/v1/auth/login", () => problem(429, "RATE_LIMITED", "요청이 너무 많습니다")));
  await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  expect(await screen.findByRole("alert")).toHaveTextContent("1분 뒤 다시 시도해 주세요");
});

test("액세스 토큰이 만료된 뒤 화면을 쓰면 스스로 토큰을 다시 받아 하던 일이 끊기지 않는다", async () => {
  await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("heading", { name: "기기 목록" });
  expireAccessTokens();
  await expect(unwrap(api.GET("/api/v1/auth/me"))).resolves.toMatchObject({ role: "ADMIN" });
  expect(screen.getByRole("heading", { name: "기기 목록" })).toBeInTheDocument();
});

test("다시 받기도 실패하면(리프레시 만료) 로그인 화면으로 가고 다시 로그인해 주세요가 보인다", async () => {
  await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("heading", { name: "기기 목록" });
  expireAccessTokens();
  db.refreshAccount = null;
  await unwrap(api.GET("/api/v1/auth/me")).catch(() => undefined);
  expect(await screen.findByText("로그인 시간이 지났습니다. 다시 로그인해 주세요.")).toBeInTheDocument();
});

test("로그아웃하면 첫 화면으로 가고 관리 화면을 다시 열면 관리자 로그인으로 간다", async () => {
  const { user, router } = await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("heading", { name: "기기 목록" });
  await user.click(screen.getByRole("button", { name: "로그아웃" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  await waitFor(() => expect(tokenStore.get()).toBeNull());
  await router.navigate("/admin/devices");
  expect(await screen.findByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "기기 목록" })).not.toBeInTheDocument();
  expect(tokenStore.get()).toBeNull();
});

test("고객 계정으로 관리 화면에 로그인하면 관리자 전용 문장이 보이고 관리 화면은 열리지 않는다", async () => {
  await loginAs(MOCK_CUSTOMER.email, MOCK_CUSTOMER.password);
  expect(await screen.findByText(/관리자 전용 화면입니다/)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "기기 목록" })).not.toBeInTheDocument();
  expect(tokenStore.get()).toBeNull();
});

test("로그인한 뒤 브라우저 저장소에 액세스 토큰이 없다", async () => {
  await loginAs(MOCK_ADMIN.email, MOCK_ADMIN.password);
  await screen.findByRole("heading", { name: "기기 목록" });
  const token = tokenStore.get()?.accessToken ?? "";
  expect(token).not.toBe("");
  const stored = [localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => s.getItem(k) ?? ""));
  expect(stored.some((v) => v.includes(token))).toBe(false);
  expect(document.cookie).not.toContain(token);
});

test("새로 고침해도 리프레시 쿠키가 살아 있으면 다시 로그인하지 않는다", async () => {
  db.refreshAccount = db.accounts[0];
  renderApp("/admin/devices");
  expect(await screen.findByRole("heading", { name: "기기 목록" })).toBeInTheDocument();
});

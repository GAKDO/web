import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../shared/mocks/node";
import { renderApp } from "../../test/renderApp";

afterEach(() => vi.unstubAllEnvs());

const ACCOUNT_ON = "phoneCapture,diagnostics,report,pilot";

test("서버에 켜진 제공자만 'Google로 계속하기' 같은 버튼으로 보이고, 시작 주소에 돌아올 경로를 싣는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  server.use(http.get("*/api/v1/auth/oauth/providers", () => HttpResponse.json({ providers: ["GOOGLE", "GITHUB"] })));
  renderApp("/login?next=/my/rentals");

  const google = await screen.findByRole("link", { name: "Google로 계속하기" });
  expect(google.getAttribute("href")).toMatch(/\/api\/v1\/auth\/oauth\/google\/start\?next=%2Fmy%2Frentals$/);
  expect(screen.getByRole("link", { name: "GitHub로 계속하기" }).getAttribute("href")).toContain("/oauth/github/start");
  expect(screen.queryByRole("link", { name: "카카오로 계속하기" })).not.toBeInTheDocument();
});

test("켜진 제공자가 없으면 소셜 버튼 없이 이메일 로그인만 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login");
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "소셜 로그인" })).not.toBeInTheDocument();
});

test("콜백이 이메일을 받지 못해 돌아오면 이메일 제공 동의를 안내한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login?socialError=EMAIL_REQUIRED");
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 제공에 동의");
});

test("회원 가입을 숨긴 배포에서는 소셜 버튼을 보이지 않는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "diagnostics,pilot,account");
  server.use(http.get("*/api/v1/auth/oauth/providers", () => HttpResponse.json({ providers: ["GOOGLE"] })));
  renderApp("/login");
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Google로 계속하기" })).not.toBeInTheDocument();
});

test("모르는 socialError 값(constructor 같은 이름 포함)은 일반 실패 안내로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login?socialError=constructor");
  expect(await screen.findByRole("alert")).toHaveTextContent("로그인 서비스와 연결하지 못했습니다");
});

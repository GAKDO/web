// 이 파일이 확인하는 것: 고객 로그인 화면의 소셜 로그인(Google·GitHub 등, 11/10) 버튼.

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../shared/mocks/node";
import { renderApp } from "../../test/renderApp";

afterEach(() => vi.unstubAllEnvs());

// 테스트 도구: 계정 기능(회원가입·소셜 로그인)은 켜고 다른 기능만 보관(숨김)한 설정.
const ACCOUNT_ON = "phoneCapture,diagnostics,report,pilot";

// [상황] 서버가 Google·GitHub만 켜 두었고, 로그인 뒤 마이페이지로 돌아가도록 주소에 적었다.
// [기대] "Google로 계속하기"·"GitHub로 계속하기"만 보이고(카카오는 없음), 시작 주소에 돌아올 경로가 실린다.
//        이메일 로그인이 위, "또는" 아래에 소셜 버튼이 온다.
test("서버에 켜진 제공자만 'Google로 계속하기' 같은 버튼으로 보이고, 시작 주소에 돌아올 경로를 싣는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  server.use(http.get("*/api/v1/auth/oauth/providers", () => HttpResponse.json({ providers: ["GOOGLE", "GITHUB"] })));
  renderApp("/login?next=/my/rentals");

  const google = await screen.findByRole("link", { name: "Google로 계속하기" });
  expect(google.getAttribute("href")).toMatch(/\/api\/v1\/auth\/oauth\/google\/start\?next=%2Fmy%2Frentals$/);
  expect(screen.getByRole("link", { name: "GitHub로 계속하기" }).getAttribute("href")).toContain("/oauth/github/start");
  expect(screen.queryByRole("link", { name: "카카오로 계속하기" })).not.toBeInTheDocument();
  // 이메일 로그인이 위, "또는" 뒤에 소셜 버튼이 아래
  const emailInput = screen.getByLabelText("이메일");
  expect(emailInput.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("region", { name: "소셜 로그인" })).toHaveTextContent(/^또는/);
});

// [상황] 서버에 켜진 소셜 제공자가 없다.
// [기대] 소셜 버튼 없이 이메일 로그인만 보인다.
test("켜진 제공자가 없으면 소셜 버튼 없이 이메일 로그인만 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login");
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "소셜 로그인" })).not.toBeInTheDocument();
});

// [상황] 소셜 로그인 뒤 제공자가 이메일을 주지 않아 돌아왔다(EMAIL_REQUIRED).
// [기대] "이메일 제공에 동의"해 달라고 안내한다.
test("콜백이 이메일을 받지 못해 돌아오면 이메일 제공 동의를 안내한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login?socialError=EMAIL_REQUIRED");
  expect(await screen.findByRole("alert")).toHaveTextContent("이메일 제공에 동의");
});

// [상황] 계정 기능을 보관(숨김)으로 설정한 배포다.
// [기대] 서버에 Google이 켜져 있어도 소셜 버튼을 보이지 않는다.
test("회원 가입을 숨긴 배포에서는 소셜 버튼을 보이지 않는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "diagnostics,pilot,account");
  server.use(http.get("*/api/v1/auth/oauth/providers", () => HttpResponse.json({ providers: ["GOOGLE"] })));
  renderApp("/login");
  expect(await screen.findByLabelText("이메일")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Google로 계속하기" })).not.toBeInTheDocument();
});

// [상황] 주소의 오류 값이 모르는 값("constructor")이다.
// [기대] 일반 실패 안내("로그인 서비스와 연결하지 못했습니다")를 보인다(이상한 값으로 화면이 깨지지 않음).
test("모르는 socialError 값(constructor 같은 이름 포함)은 일반 실패 안내로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", ACCOUNT_ON);
  renderApp("/login?socialError=constructor");
  expect(await screen.findByRole("alert")).toHaveTextContent("로그인 서비스와 연결하지 못했습니다");
});

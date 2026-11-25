// 이 파일이 확인하는 것: 로그인 없이 보는 법적 고지 화면(개인정보처리방침, 이용약관, 오픈소스 고지).

import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, test } from "vitest";
import { MODEL_NOTICES, OpenSourcePage, PrivacyPage, SERVER_NOTICES, TermsPage, WEB_NOTICES } from "./components/LegalPages";

// 테스트 도구: 세 고지 화면만 있는 라우터로 그 주소를 연다.
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/licenses", element: <OpenSourcePage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

// [상황] 로그인 없이 개인정보처리방침을 연다.
// [기대] 제목과 소셜 로그인 때 받는 항목("제공자가 인증한 이메일")이 보인다.
test("로그인 없이 /privacy에서 개인정보처리방침과 소셜 로그인 수집 항목을 본다", () => {
  renderAt("/privacy");
  expect(screen.getByRole("heading", { level: 1, name: "개인정보처리방침" })).toBeInTheDocument();
  expect(screen.getByText(/제공자가 인증한 이메일/)).toBeInTheDocument();
});

// [상황] 로그인 없이 이용약관을 연다.
// [기대] 제목이 보이고 개인정보처리방침으로 가는 링크가 있다.
test("로그인 없이 /terms에서 이용약관을 보고 개인정보처리방침으로 갈 수 있다", () => {
  renderAt("/terms");
  expect(screen.getByRole("heading", { level: 1, name: "이용약관" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
});

// [상황] 개인정보처리방침을 본다.
// [기대] 사이트 도우미(챗봇)가 질문을 Google Gemini API로 보낸다고 알린다.
test("개인정보처리방침은 사이트 도우미가 질문을 Google Gemini로 보낸다고 알린다", () => {
  renderAt("/privacy");
  expect(screen.getByText(/Google Gemini API로 보내/)).toBeInTheDocument();
});

// [상황] 로그인 없이 오픈소스 고지를 연다.
// [기대] 탐지 모델 Ultralytics YOLO11의 사용 조건이 AGPL-3.0으로 보이고, 소스 공개 주소(github.com/GAKDO) 링크와 모델·서버·웹에서 쓰는 오픈소스가 모두 표에 있다.
test("로그인 없이 /licenses에서 쓰는 오픈소스와 사용 조건을 보고, 탐지 모델(YOLO11)이 AGPL-3.0임을 안다", () => {
  renderAt("/licenses");
  expect(screen.getByRole("heading", { level: 1, name: "오픈소스 고지" })).toBeInTheDocument();
  const row = screen.getByRole("rowheader", { name: "Ultralytics YOLO11" }).closest("tr")!;
  expect(row).toHaveTextContent("AGPL-3.0");
  expect(screen.getByRole("link", { name: "github.com/GAKDO" })).toHaveAttribute("href", "https://github.com/GAKDO");
  for (const n of [...MODEL_NOTICES, ...SERVER_NOTICES, ...WEB_NOTICES]) expect(screen.getByRole("rowheader", { name: n.name })).toBeInTheDocument();
});

// [상황] 이용약관을 본다.
// [기대] 오픈소스 고지로 가는 링크가 있다.
test("이용약관에서 오픈소스 고지로 갈 수 있다", () => {
  renderAt("/terms");
  expect(screen.getByRole("link", { name: "오픈소스 고지" })).toHaveAttribute("href", "/licenses");
});

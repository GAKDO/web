import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, test } from "vitest";
import { PrivacyPage, TermsPage } from "./components/LegalPages";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/terms", element: <TermsPage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

test("로그인 없이 /privacy에서 개인정보처리방침과 소셜 로그인 수집 항목을 본다", () => {
  renderAt("/privacy");
  expect(screen.getByRole("heading", { level: 1, name: "개인정보처리방침" })).toBeInTheDocument();
  expect(screen.getByText(/제공자가 인증한 이메일/)).toBeInTheDocument();
});

test("로그인 없이 /terms에서 이용약관을 보고 개인정보처리방침으로 갈 수 있다", () => {
  renderAt("/terms");
  expect(screen.getByRole("heading", { level: 1, name: "이용약관" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
});

test("개인정보처리방침은 사이트 도우미가 질문을 Google Gemini로 보낸다고 알린다", () => {
  renderAt("/privacy");
  expect(screen.getByText(/Google Gemini API로 보내/)).toBeInTheDocument();
});

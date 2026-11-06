import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp, renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

beforeEach(() => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("로그인하지 않은 사람도 이용 안내에서 창구 대여부터 반납 비교까지 네 단계를 본다", async () => {
  renderApp("/guide");
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  const steps = within(screen.getByRole("list", { name: "대여 순서" })).getAllByRole("listitem");
  expect(steps.map((li) => within(li).getByRole("heading").textContent)).toEqual([
    "01창구에서 대여",
    "02출고 검사",
    "03QR로 내 계정에 연결",
    "04반납 비교",
  ]);
  expect(screen.getByRole("link", { name: /회원가입하기/ })).toHaveAttribute("href", "/signup");
});

test("첫 화면의 '빌리는 방법 보기'를 누르면 이용 안내가 열린다", async () => {
  const u = userEvent.setup();
  renderApp("/");
  await u.click(await screen.findByRole("link", { name: "빌리는 방법 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
});

test("렌탈이 없는 고객은 내 렌탈에서 이용 안내로 갈 수 있고, 안내에서 내 렌탈로 돌아온다", async () => {
  const u = userEvent.setup();
  db.report.owners.clear();
  renderAsCustomer("/my/rentals");
  await u.click(await screen.findByRole("link", { name: "이용 안내 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  await u.click(screen.getByRole("link", { name: /내 렌탈 열기/ }));
  expect(await screen.findByRole("heading", { level: 1, name: "내 렌탈" })).toBeInTheDocument();
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";

// 11/8: 모든 화면 맨 위 고정 헤더에서 내 정보·핵심 기능으로 바로 간다

function setMobile(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("고객은 헤더에서 마이페이지·이용 안내·내 정보로 바로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderAsCustomer("/my/rentals");
  const nav = await screen.findByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("link", { name: "마이페이지" })).toHaveAttribute("href", "/my/rentals");
  expect(within(nav).getByRole("link", { name: "이용 안내" })).toHaveAttribute("href", "/guide");
  expect(within(nav).getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/my/account");
});

test("관리자는 헤더에서 검사 결과·기기·기종·렌탈·성능·부스 화면으로 가고 로그아웃할 수 있다", async () => {
  renderAsAdmin("/admin/devices");
  const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
  for (const name of ["검사 결과", "기기", "기종", "렌탈", "성능"]) expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
  expect(within(nav).getByRole("link", { name: /부스 화면/ })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

test("로그인 전 첫 화면 헤더에는 로그인·회원가입이 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  expect(within(header).getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(within(header).getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/signup");
});

test("폰에서는 메뉴 버튼을 누르면 큰 글자 메뉴가 펼쳐지고 Esc로 닫힌다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  setMobile(true);
  const user = userEvent.setup();
  renderAsCustomer("/my/rentals");
  const button = await screen.findByRole("button", { name: "메뉴 열기" });
  expect(screen.queryByRole("navigation", { name: "고객 메뉴" })).not.toBeInTheDocument();
  await user.click(button);
  const nav = screen.getByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/my/account");
  expect(screen.getByRole("button", { name: "메뉴 닫기" })).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("navigation", { name: "고객 메뉴" })).not.toBeInTheDocument();
});

test("리포트를 보관한 배포에서도 폰의 로그인 전 사람은 메뉴를 열어 로그인으로 갈 수 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  setMobile(true);
  const user = userEvent.setup();
  renderApp("/");
  await user.click(await screen.findByRole("button", { name: "메뉴 열기" }));
  const nav = screen.getByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("link", { name: /로그인$/ })).toHaveAttribute("href", "/login");
});

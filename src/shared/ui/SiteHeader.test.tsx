import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { server } from "../mocks/node";

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

test("관리자로 로그인한 채 첫 화면에 있으면 헤더에 로그아웃이 있고, 누르면 첫 화면에 남은 채 로그아웃된다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  await user.click(await within(header).findByRole("button", { name: "로그아웃" }));
  expect(await within(header).findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(router.state.location.pathname).toBe("/");
});

test("고객도 헤더 오른쪽 위에 로그아웃이 있고, 누르면 첫 화면으로 가며 로그아웃된다(11/12)", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const user = userEvent.setup();
  const { router } = renderAsCustomer("/my/rentals");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  await user.click(await within(header).findByRole("button", { name: "로그아웃" }));
  const home = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  expect(await within(home).findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(router.state.location.pathname).toBe("/");
});

test("폰에서 고객은 펼침 메뉴 맨 아래에서 로그아웃한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  setMobile(true);
  const user = userEvent.setup();
  renderAsCustomer("/devices");
  await user.click(await screen.findByRole("button", { name: "메뉴 열기" }));
  const nav = screen.getByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

test("로그인 전에는 헤더에 로그아웃이 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/devices");
  await screen.findByRole("link", { name: "회원가입" });
  expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
});

test("관리자 로그아웃을 서버가 확인하지 못하면 로그인 화면에서 서버에 알리지 못했다고 알린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  server.use(http.post("*/api/v1/auth/logout", () => HttpResponse.error()));
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  await user.click(await within(header).findByRole("button", { name: "로그아웃" }));
  expect(await screen.findByText(/서버에 알리지 못했습니다/)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

function pendingItem(i: number) {
  return {
    checkpointId: `cp-${i}`,
    rentalId: `rental-${i}`,
    captureSetId: `set-${i}`,
    source: "BOOTH" as const,
    profile: "FULL" as const,
    modelVersion: "v004",
    pending: 3,
    confirmed: 0,
    dismissed: 0,
    completedAt: "2026-11-12T10:00:00+09:00",
    reviewCompletedAt: null,
  };
}

test("사람 검수를 기다리는 시점이 있으면 어느 관리 화면에서든 메뉴 검사 결과 옆에 대기 건수가 보인다", async () => {
  server.use(
    http.get("*/api/v1/captures/reviews", ({ request }) =>
      HttpResponse.json({ items: new URL(request.url).searchParams.get("status") === "CONFIRMED" ? [] : [pendingItem(1), pendingItem(2)] }),
    ),
  );
  renderAsAdmin("/admin/devices");
  const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
  const link = within(nav).getByRole("link", { name: "검사 결과" });
  expect(await within(link).findByText("2")).toBeInTheDocument();
  expect(link).toHaveAccessibleDescription("검수 대기 2건");
});

test("검수 대기가 상한(20건)만큼이면 20+로, 대기가 없으면 숫자를 보이지 않는다", async () => {
  server.use(http.get("*/api/v1/captures/reviews", () => HttpResponse.json({ items: Array.from({ length: 20 }, (_, i) => pendingItem(i)) })));
  const first = renderAsAdmin("/admin/rentals");
  const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
  expect(await within(within(nav).getByRole("link", { name: "검사 결과" })).findByText("20+")).toBeInTheDocument();
  first.unmount();

  server.use(http.get("*/api/v1/captures/reviews", () => HttpResponse.json({ items: [] })));
  renderAsAdmin("/admin/rentals");
  const again = await screen.findByRole("navigation", { name: "관리 메뉴" });
  await screen.findByRole("heading", { name: "렌탈 목록" });
  expect(within(again).getByRole("link", { name: "검사 결과" })).not.toHaveAccessibleDescription();
});

test("고객 화면 헤더는 검수 대기 목록을 묻지 않는다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  let asked = false;
  server.use(
    http.get("*/api/v1/captures/reviews", () => {
      asked = true;
      return HttpResponse.json({ items: [] });
    }),
  );
  renderAsCustomer("/my/rentals");
  await screen.findByRole("navigation", { name: "고객 메뉴" });
  expect(asked).toBe(false);
});

test("폰 아래 탭의 검사 결과에도 검수 대기 건수가 보이고 화면 읽기는 설명으로 읽는다", async () => {
  setMobile(true);
  server.use(http.get("*/api/v1/captures/reviews", () => HttpResponse.json({ items: [pendingItem(1)] })));
  renderAsAdmin("/admin/devices");
  const tabs = await screen.findByRole("navigation", { name: "자주 쓰는 관리 메뉴" });
  const link = within(tabs).getByRole("link", { name: "검사 결과" });
  expect(await within(link).findByText("1")).toBeInTheDocument();
  expect(link).toHaveAccessibleDescription("검수 대기 1건");
});

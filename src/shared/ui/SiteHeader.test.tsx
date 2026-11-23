// 이 파일이 확인하는 것: 모든 화면 맨 위에 고정된 헤더(11/8). 고객·관리자·로그인 전 사람마다 다른 메뉴와 로그아웃 버튼,
// 폰 화면의 펼침 메뉴, 관리자 메뉴의 "검수 대기 건수" 표시를 본다.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { server } from "../mocks/node";

// 11/8: 모든 화면 맨 위 고정 헤더에서 내 정보·핵심 기능으로 바로 간다

// 테스트 도구: 화면 폭 검사(matchMedia)를 가짜로 바꿔 폰 화면인 척하거나 아닌 척한다.
function setMobile(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// 테스트 도구: 바꾼 배포 설정과 화면 폭 흉내를 되돌린다.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// [상황] 고객이 내 렌탈 화면을 연다.
// [기대] 헤더의 고객 메뉴에 마이페이지·이용 안내·내 정보 링크가 있다.
test("고객은 헤더에서 마이페이지·이용 안내·내 정보로 바로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderAsCustomer("/my/rentals");
  const nav = await screen.findByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("link", { name: "마이페이지" })).toHaveAttribute("href", "/my/rentals");
  expect(within(nav).getByRole("link", { name: "이용 안내" })).toHaveAttribute("href", "/guide");
  expect(within(nav).getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/my/account");
});

// [상황] 관리자가 기기 목록 화면을 연다.
// [기대] 관리 메뉴에 검사 결과·기기·기종·렌탈·성능이 있고, 부스 화면은 새 탭으로 열리며, 로그아웃 버튼이 있다.
test("관리자는 헤더에서 검사 결과·기기·기종·렌탈·성능·부스 화면으로 가고 로그아웃할 수 있다", async () => {
  renderAsAdmin("/admin/devices");
  const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
  for (const name of ["검사 결과", "기기", "기종", "렌탈", "성능"]) expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
  expect(within(nav).getByRole("link", { name: /부스 화면/ })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

// [상황] 로그인하지 않고 첫 화면을 연다.
// [기대] 헤더에 로그인·회원가입 링크가 있다.
test("로그인 전 첫 화면 헤더에는 로그인·회원가입이 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  expect(within(header).getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(within(header).getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/signup");
});

// [상황] 폰 화면에서 고객이 "메뉴 열기"를 누르고, Esc 키를 누른다.
// [기대] 처음엔 메뉴가 접혀 있고, 누르면 메뉴가 펼쳐지며(버튼은 "메뉴 닫기"), Esc로 닫힌다.
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

// [상황] 리포트를 숨긴 배포에서 로그인 전 사람이 폰으로 첫 화면의 메뉴를 연다.
// [기대] 메뉴에 로그인 링크가 있다.
test("리포트를 보관한 배포에서도 폰의 로그인 전 사람은 메뉴를 열어 로그인으로 갈 수 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  setMobile(true);
  const user = userEvent.setup();
  renderApp("/");
  await user.click(await screen.findByRole("button", { name: "메뉴 열기" }));
  const nav = screen.getByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("link", { name: /로그인$/ })).toHaveAttribute("href", "/login");
});

// [상황] 관리자로 로그인한 채 첫 화면에서 헤더의 "로그아웃"을 누른다.
// [기대] 첫 화면에 그대로 남고, 헤더가 로그인 링크로 바뀐다.
test("관리자로 로그인한 채 첫 화면에 있으면 헤더에 로그아웃이 있고, 누르면 첫 화면에 남은 채 로그아웃된다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/");
  const header = (await screen.findByRole("link", { name: "TRACE 첫 화면" })).closest("header")!;
  await user.click(await within(header).findByRole("button", { name: "로그아웃" }));
  expect(await within(header).findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(router.state.location.pathname).toBe("/");
});

// [상황] 고객이 내 렌탈 화면에서 헤더의 "로그아웃"을 누른다.
// [기대] 첫 화면으로 가고, 헤더가 로그인 링크로 바뀐다.
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

// [상황] 폰 화면에서 고객이 메뉴를 연다.
// [기대] 펼친 메뉴 안에 로그아웃 버튼이 있다.
test("폰에서 고객은 펼침 메뉴 맨 아래에서 로그아웃한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  setMobile(true);
  const user = userEvent.setup();
  renderAsCustomer("/devices");
  await user.click(await screen.findByRole("button", { name: "메뉴 열기" }));
  const nav = screen.getByRole("navigation", { name: "고객 메뉴" });
  expect(within(nav).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

// [상황] 로그인하지 않고 화면을 연다.
// [기대] 로그아웃 버튼이 없다.
test("로그인 전에는 헤더에 로그아웃이 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  renderApp("/devices");
  await screen.findByRole("link", { name: "회원가입" });
  expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
});

// [상황] 관리자가 로그아웃을 눌렀는데 네트워크 오류로 서버에 닿지 못한다.
// [기대] 로그인 화면으로 가서 "서버에 알리지 못했습니다"를 보인다.
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

// 테스트 도구: 사람 검수를 기다리는 시점 하나(흠집 후보 3개 대기)를 흉내 낸 값.
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

// [상황] 검수를 기다리는 시점이 2건 있고, 관리자가 기기 목록 화면을 연다.
// [기대] 관리 메뉴 "검사 결과" 옆에 2가 보이고, 화면 낭독기는 "검수 대기 2건"으로 읽는다.
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

// [상황] 검수 대기가 상한인 20건일 때와 0건일 때 각각 화면을 연다.
// [기대] 20건이면 "20+"로 보이고(그 이상일 수 있음), 0건이면 숫자와 설명이 없다.
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

// [상황] 고객이 내 렌탈 화면을 연다.
// [기대] 검수 대기 목록을 서버에 묻지 않는다(고객에겐 필요 없고 권한도 없음).
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

// [상황] 폰 화면에서 검수 대기가 1건이고, 관리자가 기기 목록을 연다.
// [기대] 아래쪽 자주 쓰는 메뉴의 "검사 결과"에도 1이 보이고, 화면 낭독기는 "검수 대기 1건"으로 읽는다.
test("폰 아래 탭의 검사 결과에도 검수 대기 건수가 보이고 화면 읽기는 설명으로 읽는다", async () => {
  setMobile(true);
  server.use(http.get("*/api/v1/captures/reviews", () => HttpResponse.json({ items: [pendingItem(1)] })));
  renderAsAdmin("/admin/devices");
  const tabs = await screen.findByRole("navigation", { name: "자주 쓰는 관리 메뉴" });
  const link = within(tabs).getByRole("link", { name: "검사 결과" });
  expect(await within(link).findByText("1")).toBeInTheDocument();
  expect(link).toHaveAccessibleDescription("검수 대기 1건");
});

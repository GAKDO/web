// 이 파일이 확인하는 것: 관리자 화면 틀(왼쪽 메뉴·로고)의 메뉴 표시와 이동.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";

afterEach(() => vi.unstubAllEnvs());

// [상황] 파일럿 대시보드 주소를 설정하고 관리자 화면을 연다.
// [기대] 관리 메뉴에 "파일럿 추이"가 보이고, 새 탭으로 안전하게(noopener) 열리는 링크다.
test("대시보드 주소가 있으면 관리 메뉴에 '파일럿 추이'가 새 탭 링크로 보인다", async () => {
  vi.stubEnv("VITE_PILOT_DASHBOARD_URL", "https://grafana.example/d/trace-pilot-trend");
  renderAsAdmin("/admin/devices");
  const link = await screen.findByRole("link", { name: /파일럿 추이/ });
  expect(link).toHaveAttribute("href", "https://grafana.example/d/trace-pilot-trend");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

// [상황] 대시보드 주소가 비어 있다.
// [기대] "파일럿 추이" 메뉴를 숨긴다.
test("대시보드 주소가 없으면 '파일럿 추이' 메뉴를 숨긴다", async () => {
  vi.stubEnv("VITE_PILOT_DASHBOARD_URL", "");
  renderAsAdmin("/admin/devices");
  await screen.findByRole("link", { name: "기기" });
  expect(screen.queryByRole("link", { name: /파일럿 추이/ })).not.toBeInTheDocument();
});

// [상황] 관리자 검사 화면에서 로고를 눌러 첫 화면으로 간 뒤 "관리자 화면" 링크를 누른다.
// [기대] 첫 화면으로 갔다가 관리자 화면(기기 목록)으로 돌아온다.
test("왼쪽 위 TRACE 로고를 누르면 첫 화면으로 가고, 첫 화면에서 관리자 화면으로 돌아올 수 있다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/inspections");
  const logo = await screen.findByRole("link", { name: "TRACE 첫 화면" });
  expect(logo).toHaveAttribute("href", "/");
  await user.click(logo);
  await user.click(await screen.findByRole("link", { name: "관리자 화면" }));
  expect(await screen.findByRole("heading", { level: 1, name: /기기/ })).toBeInTheDocument();
});

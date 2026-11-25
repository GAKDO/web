// 이 파일이 확인하는 것: 파일럿 추이 대시보드(Grafana) 링크 주소 설정.

import { pilotDashboardUrl } from "./pilotDashboard";

afterEach(() => vi.unstubAllEnvs());

// [상황] 대시보드 주소 설정이 비었거나 없다.
// [기대] 링크를 만들지 않는다.
test("주소가 없으면 대시보드 링크를 만들지 않는다", () => {
  vi.stubEnv("VITE_PILOT_DASHBOARD_URL", "");
  expect(pilotDashboardUrl()).toBeNull();
  expect(pilotDashboardUrl(undefined)).toBeNull();
  expect(pilotDashboardUrl("")).toBeNull();
});

// [상황] https 주소, javascript: 주소, 그냥 글자를 넣는다.
// [기대] http(s) 주소만 링크로 쓰고 나머지는 버린다(위험한 링크 방지).
test("http(s) 주소만 링크로 쓴다", () => {
  expect(pilotDashboardUrl("https://grafana.example/d/trace-pilot-trend")).toBe(
    "https://grafana.example/d/trace-pilot-trend",
  );
  expect(pilotDashboardUrl("javascript:alert(1)")).toBeNull();
  expect(pilotDashboardUrl("그냥 글자")).toBeNull();
});

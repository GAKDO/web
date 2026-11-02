import { pilotDashboardUrl } from "./pilotDashboard";

test("주소가 없으면 대시보드 링크를 만들지 않는다", () => {
  expect(pilotDashboardUrl(undefined)).toBeNull();
  expect(pilotDashboardUrl("")).toBeNull();
});

test("http(s) 주소만 링크로 쓴다", () => {
  expect(pilotDashboardUrl("https://grafana.example/d/trace-pilot-trend")).toBe(
    "https://grafana.example/d/trace-pilot-trend",
  );
  expect(pilotDashboardUrl("javascript:alert(1)")).toBeNull();
  expect(pilotDashboardUrl("그냥 글자")).toBeNull();
});

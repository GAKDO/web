/**
 * 파일럿 추이 대시보드(FR-PIL-02) 주소. 대시보드는 학교 Grafana에 있고 웹은 링크만 단다.
 * 빌드할 때 VITE_PILOT_DASHBOARD_URL로 받는다. 비었거나 http(s)가 아니면 null(메뉴를 숨김).
 */
export function pilotDashboardUrl(raw: string | undefined = import.meta.env.VITE_PILOT_DASHBOARD_URL): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

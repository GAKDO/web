/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** gateway 주소. 비우면 같은 출처의 /api를 쓴다(개발은 vite 프록시) */
  readonly VITE_API_BASE?: string;
  /** "true"면 브라우저에서 MSW 목 서버를 켠다 */
  readonly VITE_USE_MOCK?: string;
  /** 학교 Grafana의 파일럿 추이 대시보드 주소(FR-PIL-02). 비우면 메뉴를 숨긴다 */
  readonly VITE_PILOT_DASHBOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

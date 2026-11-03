/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** gateway 주소. 비우면 같은 출처의 /api를 쓴다(개발은 vite 프록시) */
  readonly VITE_API_BASE?: string;
  /** "true"면 브라우저에서 MSW 목 서버를 켠다 */
  readonly VITE_USE_MOCK?: string;
  /** 학교 Grafana의 파일럿 추이 대시보드 주소(FR-PIL-02). 비우면 메뉴를 숨긴다 */
  readonly VITE_PILOT_DASHBOARD_URL?: string;
  /** 시연용 고객 계정 이메일, 쉼표로 구분(비밀번호는 넣지 않음) */
  readonly VITE_DEMO_CUSTOMER_EMAILS?: string;
  /** MVP 배포에서 메뉴·링크를 숨기는 보관 기능, 쉼표로 구분(src/shared/config/features.ts). 비우면 모두 보인다 */
  readonly VITE_ARCHIVED_FEATURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

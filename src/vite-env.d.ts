/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** gateway 주소. 비우면 같은 출처의 /api를 쓴다(개발은 vite 프록시) */
  readonly VITE_API_BASE?: string;
  /** "true"면 브라우저에서 MSW 목 서버를 켠다 */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

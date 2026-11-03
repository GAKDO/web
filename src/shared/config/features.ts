/**
 * 보관 기능(11/3 방향 전환, 민서 승인): 코드는 develop에 그대로 두고 MVP 배포에서는 메뉴·링크만 숨긴다.
 * 빌드할 때 VITE_ARCHIVED_FEATURES에 쉼표로 적는다(예: "phoneCapture,diagnostics,report,account,pilot").
 * 비우면 아무것도 숨기지 않는다(개발·테스트 기본). 모르는 이름은 무시한다.
 * 화면 주소(라우트)는 그대로 열리고, 재도입(11/10~12)은 목록에서 이름을 빼면 된다.
 */
export const ARCHIVABLE_FEATURES = [
  /** 폰 수령 촬영(WE2): 렌탈 상세의 수령 QR 발급 */
  "phoneCapture",
  /** 진단 에이전트(DI1·AG1): 렌탈 상세의 페어링 코드 */
  "diagnostics",
  /** 3D 리포트·해시 체인(WE3·RP1·RP2): 렌탈 상세의 "리포트 보기" */
  "report",
  /** 회원 가입·메일 인증·비밀번호 재설정(AU2): 고객 로그인 화면의 링크 */
  "account",
  /** 파일럿 추이 Grafana(WE4): 관리 메뉴 링크 */
  "pilot",
] as const;

export type ArchivableFeature = (typeof ARCHIVABLE_FEATURES)[number];

/** 숨길 기능 목록. 쉼표·공백으로 나누고 아는 이름만 남긴다 */
export function archivedFeatures(raw: string | undefined = import.meta.env.VITE_ARCHIVED_FEATURES): Set<ArchivableFeature> {
  const known = new Set<string>(ARCHIVABLE_FEATURES);
  const names = (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => known.has(s)) as ArchivableFeature[];
  return new Set(names);
}

/** 이 기능을 MVP 배포에서 숨기나. 부를 때마다 환경 변수를 읽어 테스트에서 바꿔 끼울 수 있다 */
export function isArchived(feature: ArchivableFeature, raw: string | undefined = import.meta.env.VITE_ARCHIVED_FEATURES): boolean {
  return archivedFeatures(raw).has(feature);
}

import { isArchived } from "./features";

/**
 * 고객이 로그인·가입·인증을 마친 뒤 기본으로 갈 곳.
 * 3D 리포트(report)를 숨긴 배포에서는 내 렌탈 주소가 첫 화면으로 돌아가므로(ArchivedRoute) 내 계정 화면으로 보낸다
 */
export function customerHome(): string {
  return isArchived("report") ? "/my/account" : "/my/rentals";
}

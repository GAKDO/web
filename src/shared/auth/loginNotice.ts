import type { AuthNotice } from "./AuthProvider";

/** 관리자·고객 로그인 화면이 같이 쓰는 안내 문장 */
export const LOGIN_NOTICE: Record<Exclude<AuthNotice, null>, string> = {
  expired: "로그인 시간이 지났습니다. 다시 로그인해 주세요.",
  notAdmin: "관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요.",
  notCustomer: "고객 계정으로 로그인해 주세요.",
};

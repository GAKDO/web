import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../shared/api/client";

// 비밀번호 재설정(FR-USR-06)·탈퇴(FR-USR-04). auth-server 계약 그대로 부른다

/** 가입된 이메일이면 재설정 코드를 보낸다. 계정 존재 여부를 드러내지 않도록 서버는 항상 202 */
export function requestPasswordReset(email: string): Promise<unknown> {
  return unwrap(api.POST("/api/v1/auth/password/reset-request", { body: { email } }));
}

/** 코드 + 새 비밀번호. 성공하면 서버가 그 계정의 리프레시 토큰을 모두 폐기한다 */
export function resetPassword(email: string, code: string, newPassword: string): Promise<unknown> {
  return unwrap(api.POST("/api/v1/auth/password/reset", { body: { email, code, newPassword } }));
}

/** 비밀번호를 확인한 뒤 개인정보를 지우고 탈퇴한다. 렌탈 기록은 남는다 */
export function withdraw(password: string): Promise<unknown> {
  return unwrap(api.DELETE("/api/v1/auth/me", { body: { password } }));
}

/** 내 정보(이름·이메일·상태·연결된 렌탈 ID). 마이페이지·내 정보 화면이 같이 쓴다 */
export function useMe() {
  return useQuery({
    queryKey: ["account", "me"],
    queryFn: () => unwrap(api.GET("/api/v1/auth/me")),
    staleTime: 60_000,
  });
}

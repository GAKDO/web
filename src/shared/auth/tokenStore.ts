import type { TokenResponse, TokenRole } from "../api/types";

// 액세스 토큰은 이 모듈 변수에만 둔다. localStorage·sessionStorage·쿠키에 쓰지 않는다(FR-002).
export interface Session {
  accessToken: string;
  role: TokenRole;
  expiresAt: number;
}

let session: Session | null = null;
/** set·clear 때마다 1씩 오른다. 늦게 도착한 토큰 다시 받기 결과가 그사이 로그인·로그아웃을 덮어쓰지 않게 한다 */
let epoch = 0;

export const tokenStore = {
  get: (): Session | null => session,
  epoch: (): number => epoch,
  set(token: TokenResponse): Session {
    epoch += 1;
    session = { accessToken: token.accessToken, role: token.role, expiresAt: Date.now() + token.expiresIn * 1000 };
    return session;
  },
  clear(): void {
    epoch += 1;
    session = null;
  },
};

import type { TokenResponse, TokenRole } from "../api/types";

// 액세스 토큰은 이 모듈 변수에만 둔다. localStorage·sessionStorage·쿠키에 쓰지 않는다(FR-002).
export interface Session {
  accessToken: string;
  role: TokenRole;
  expiresAt: number;
}

let session: Session | null = null;

export const tokenStore = {
  get: (): Session | null => session,
  set(token: TokenResponse): Session {
    session = { accessToken: token.accessToken, role: token.role, expiresAt: Date.now() + token.expiresIn * 1000 };
    return session;
  },
  clear(): void {
    session = null;
  },
};

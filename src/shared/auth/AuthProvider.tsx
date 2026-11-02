import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, setSessionExpiredHandler, unwrap } from "../api/client";
import type { TokenRole } from "../api/types";
import { tokenStore } from "./tokenStore";

export type AuthStatus = "unknown" | "authenticated" | "anonymous";
/** 로그인 화면에 보일 안내 */
export type AuthNotice = "expired" | "notAdmin" | "notCustomer" | null;
/** 화면이 세션으로 받는 역할. 관리자 화면은 ADMIN, 고객 화면(WE2·WE3)은 CUSTOMER(관리자도 들어올 수 있음) */
export type SessionRole = Extract<TokenRole, "ADMIN" | "CUSTOMER">;

const SESSION_ROLES: readonly TokenRole[] = ["ADMIN", "CUSTOMER"];
const isSessionRole = (role: TokenRole | undefined): role is SessionRole => !!role && SESSION_ROLES.includes(role);

interface AuthValue {
  status: AuthStatus;
  role: SessionRole | null;
  notice: AuthNotice;
  /** expected와 다른 역할이면 로그아웃하고 notice로 알린다. 기본은 관리자(WE1) */
  login(email: string, password: string, expected?: SessionRole): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [role, setRole] = useState<SessionRole | null>(null);
  const [notice, setNotice] = useState<AuthNotice>(null);

  const endSession = useCallback(
    (next: AuthNotice) => {
      tokenStore.clear();
      queryClient.clear();
      setNotice(next);
      setRole(null);
      setStatus("anonymous");
    },
    [queryClient],
  );

  // 새로 고침·새 탭: 리프레시 쿠키로 세션을 되살린다(FR-003)
  useEffect(() => {
    setSessionExpiredHandler(() => endSession("expired"));
    let alive = true;
    void refreshSession().then((ok) => {
      if (!alive) return;
      const restored = tokenStore.get()?.role;
      if (ok && isSessionRole(restored)) {
        setRole(restored);
        setStatus("authenticated");
      } else {
        // 처음 되살리기에 실패하면 지울 캐시가 없다. queryClient.clear()를 부르면
        // 로그인 없이 여는 공개 화면의 진행 중 요청이 사라져 "불러오는 중"에 멈춘다(web#8과 같은 수정)
        tokenStore.clear();
        setRole(null);
        setStatus("anonymous");
      }
    });
    return () => {
      alive = false;
    };
  }, [endSession]);

  const logout = useCallback(async () => {
    await unwrap(api.POST("/api/v1/auth/logout")).catch(() => undefined);
    endSession(null);
  }, [endSession]);

  const login = useCallback(
    async (email: string, password: string, expected: SessionRole = "ADMIN") => {
      const token = await unwrap(api.POST("/api/v1/auth/login", { body: { email, password } }));
      tokenStore.set(token);
      // 고객 화면에는 관리자도 들어올 수 있다(시연 확인용). 관리자 화면에는 관리자만
      const allowed = expected === "ADMIN" ? token.role === "ADMIN" : isSessionRole(token.role);
      if (!allowed || !isSessionRole(token.role)) {
        await logout();
        setNotice(expected === "ADMIN" ? "notAdmin" : "notCustomer");
        return;
      }
      setNotice(null);
      setRole(token.role);
      setStatus("authenticated");
    },
    [logout],
  );

  const value = useMemo(() => ({ status, role, notice, login, logout }), [status, role, notice, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 밖에서 useAuth를 불렀습니다");
  return value;
}

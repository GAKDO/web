import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, setSessionExpiredHandler, unwrap } from "../api/client";
import { tokenStore } from "./tokenStore";

export type AuthStatus = "unknown" | "authenticated" | "anonymous";
/** 로그인 화면에 보일 안내 */
export type AuthNotice = "expired" | "notAdmin" | null;

interface AuthValue {
  status: AuthStatus;
  notice: AuthNotice;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [notice, setNotice] = useState<AuthNotice>(null);

  const endSession = useCallback(
    (next: AuthNotice) => {
      tokenStore.clear();
      queryClient.clear();
      setNotice(next);
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
      if (ok && tokenStore.get()?.role === "ADMIN") {
        setStatus("authenticated");
      } else {
        // 처음 되살리기에 실패하면 지울 캐시가 없다. queryClient.clear()를 부르면
        // 로그인 없이 여는 공개 화면(검증 페이지)의 진행 중 요청이 사라져 "불러오는 중"에 멈춘다
        tokenStore.clear();
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
    async (email: string, password: string) => {
      const token = await unwrap(api.POST("/api/v1/auth/login", { body: { email, password } }));
      tokenStore.set(token);
      if (token.role !== "ADMIN") {
        await logout();
        setNotice("notAdmin");
        return;
      }
      setNotice(null);
      setStatus("authenticated");
    },
    [logout],
  );

  const value = useMemo(() => ({ status, notice, login, logout }), [status, notice, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 밖에서 useAuth를 불렀습니다");
  return value;
}

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/** 고객 화면(WE2 촬영·WE3 내 렌탈)의 가드. 고객·관리자 모두 들어오고, 로그인 전이면 /login?next=지금 주소 */
export function RequireCustomer() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "unknown") return <p className="page">로그인 상태를 확인하는 중…</p>;
  if (status === "anonymous") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

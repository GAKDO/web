import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SiteHeader } from "../ui/SiteHeader";
import { useAuth } from "./AuthProvider";

/**
 * 고객 화면(WE2 촬영·WE3 내 렌탈)의 가드. 고객·관리자 모두 들어오고, 로그인 전이면 /login?next=지금 주소.
 * customerOnly(내 계정·탈퇴)는 고객 계정을 다루는 곳이라 관리자는 관리자 화면으로 보낸다(관리자 계정을 고객 탈퇴로 지우지 않게).
 * 맨 위 고정 헤더(SiteHeader)에서 마이페이지·이용 안내·내 정보(관리자는 관리자 화면)로 바로 간다
 */
export function RequireCustomer({ customerOnly = false }: { customerOnly?: boolean }) {
  const { status, role } = useAuth();
  const location = useLocation();
  if (status === "unknown") return <p className="page">로그인 상태를 확인하는 중…</p>;
  if (status === "anonymous") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (customerOnly && role === "ADMIN") return <Navigate to="/admin/devices" replace />;
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <Outlet />
    </div>
  );
}

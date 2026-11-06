import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isArchived } from "../config/features";
import { SiteBar } from "../ui/SiteBar";
import { useAuth } from "./AuthProvider";

const NAV = "rounded-md px-3 py-1.5 text-zinc-300 no-underline transition-colors hover:bg-white/10 hover:text-white";

/**
 * 고객 화면(WE2 촬영·WE3 내 렌탈)의 가드. 고객·관리자 모두 들어오고, 로그인 전이면 /login?next=지금 주소.
 * customerOnly(내 계정·탈퇴)는 고객 계정을 다루는 곳이라 관리자는 관리자 화면으로 보낸다(관리자 계정을 고객 탈퇴로 지우지 않게)
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
      <SiteBar>
        {!isArchived("report") && (
          <NavLink to="/my/rentals" className={({ isActive }) => cn(NAV, isActive && "bg-white/10 text-white")}>
            마이페이지
          </NavLink>
        )}
        {!isArchived("report") && (
          <NavLink to="/guide" className={NAV}>
            이용 안내
          </NavLink>
        )}
        {role === "ADMIN" ? (
          <NavLink to="/admin/devices" className={NAV}>
            관리자 화면
          </NavLink>
        ) : !isArchived("account") && (
          <NavLink to="/my/account" end className={({ isActive }) => cn(NAV, isActive && "bg-white/10 text-white")}>
            내 정보
          </NavLink>
        )}
      </SiteBar>
      <Outlet />
    </div>
  );
}

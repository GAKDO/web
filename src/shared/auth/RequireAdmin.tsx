import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Button } from "../ui/Button";
import { isArchived } from "../config/features";
import { pilotDashboardUrl } from "../config/pilotDashboard";

/** 관리자만 들어오는 화면의 틀. 로그인하지 않았으면 로그인 화면으로 보낸다(FR-006) */
export function RequireAdmin() {
  const { status, role, logout } = useAuth();
  // 파일럿 추이(Grafana)는 MVP 배포에서 보관(VITE_ARCHIVED_FEATURES=pilot)이면 주소가 있어도 숨긴다
  const pilotUrl = isArchived("pilot") ? null : pilotDashboardUrl();
  if (status === "unknown") return <p className="page">로그인 상태를 확인하는 중…</p>;
  if (status === "anonymous" || role !== "ADMIN") return <Navigate to="/admin/login" replace />;
  return (
    <div className="admin">
      <header className="admin-header">
        <strong>TRACE 관리</strong>
        <nav aria-label="관리 메뉴">
          <NavLink to="/admin/inspections">검사 결과</NavLink>
          <NavLink to="/admin/devices">기기</NavLink>
          <NavLink to="/admin/models">기종</NavLink>
          <NavLink to="/admin/rentals">렌탈</NavLink>
          {/* 파일럿 추이는 학교 Grafana에 있어 새 탭으로 연다(FR-PIL-02) */}
          {pilotUrl && (
            <a href={pilotUrl} target="_blank" rel="noopener noreferrer">
              파일럿 추이 ↗
            </a>
          )}
        </nav>
        <Button onClick={() => logout()}>로그아웃</Button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

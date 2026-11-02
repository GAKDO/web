import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Button } from "../ui/Button";

/** 관리자만 들어오는 화면의 틀. 로그인하지 않았으면 로그인 화면으로 보낸다(FR-006) */
export function RequireAdmin() {
  const { status, role, logout } = useAuth();
  if (status === "unknown") return <p className="page">로그인 상태를 확인하는 중…</p>;
  if (status === "anonymous" || role !== "ADMIN") return <Navigate to="/admin/login" replace />;
  return (
    <div className="admin">
      <header className="admin-header">
        <strong>TRACE 관리</strong>
        <nav aria-label="관리 메뉴">
          <NavLink to="/admin/devices">기기</NavLink>
          <NavLink to="/admin/rentals">렌탈</NavLink>
        </nav>
        <Button onClick={() => logout()}>로그아웃</Button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

import { Navigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";

export function LoginPage() {
  const { status, role, notice, login } = useAuth();

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;

  return (
    <div className="login-split">
      <section className="login-brand" aria-label="TRACE 소개">
        <strong className="brand">TRACE</strong>
        <div>
          <p className="login-brand-name">TRACE</p>
          <p className="login-brand-slogan">
            노트북 상태를
            <br />
            투명하게, 정확하게
          </p>
          <p className="login-brand-sub">렌탈 기기 검사 · 관리 시스템</p>
        </div>
      </section>
      <main className="login-pane">
        <div className="login-card">
          <h1>관리자 로그인</h1>
          {status === "authenticated" && role !== "ADMIN" && <p role="status">{LOGIN_NOTICE.notAdmin}</p>}
          {notice && <p role="status">{LOGIN_NOTICE[notice]}</p>}
          <LoginForm onLogin={(email, password) => login(email, password)} />
        </div>
        <p className="login-foot">TRACE Rental Management System</p>
      </main>
    </div>
  );
}

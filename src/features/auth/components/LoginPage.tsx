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
        <div className="login-brand-text">
          <p className="login-brand-name">TRACE</p>
          <p className="login-brand-slogan">
            노트북 상태를
            <br />
            투명하게, 정확하게
          </p>
          <p className="login-brand-sub">렌탈 기기 검사 · 관리 시스템</p>
        </div>
        {/* 사진 파일 대신 선으로 그린 노트북(넓은 화면의 빈 공간을 채움, 읽는 내용은 없음) */}
        <svg className="login-art" viewBox="0 0 320 200" aria-hidden="true" focusable="false">
          <rect x="60" y="20" width="200" height="130" rx="8" />
          <rect x="74" y="34" width="172" height="102" rx="3" className="login-art-screen" />
          <path d="M30 160h260l-14 20H44z" />
          <path d="M138 160h44" className="login-art-notch" />
          <path d="M96 84l24 24 48-48" className="login-art-check" />
        </svg>
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

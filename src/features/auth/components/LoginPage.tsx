import { Navigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";

export function LoginPage() {
  const { status, role, notice, login } = useAuth();

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;

  return (
    <main className="page login">
      <h1>관리자 로그인</h1>
      {status === "authenticated" && role !== "ADMIN" && <p role="status">{LOGIN_NOTICE.notAdmin}</p>}
      {notice && <p role="status">{LOGIN_NOTICE[notice]}</p>}
      <LoginForm onLogin={(email, password) => login(email, password)} />
    </main>
  );
}

import { Navigate } from "react-router-dom";
import { useAuth, type AuthNotice } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "./LoginForm";

export const NOTICE: Record<Exclude<AuthNotice, null>, string> = {
  expired: "로그인 시간이 지났습니다. 다시 로그인해 주세요.",
  notAdmin: "관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요.",
  notCustomer: "고객 계정으로 로그인해 주세요.",
};

export function LoginPage() {
  const { status, role, notice, login } = useAuth();

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;

  return (
    <main className="page login">
      <h1>관리자 로그인</h1>
      {status === "authenticated" && role !== "ADMIN" && <p role="status">{NOTICE.notAdmin}</p>}
      {notice && <p role="status">{NOTICE[notice]}</p>}
      <LoginForm onLogin={(email, password) => login(email, password)} />
    </main>
  );
}

import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../auth/components/LoginForm";
import { NOTICE } from "../../auth/components/LoginPage";
import { safeNext } from "../safeNext";

/** 고객 로그인 `/login?next=<돌아올 경로>`. 수령 QR(WE2)·내 렌탈(WE3)이 로그인 뒤 돌아오는 입구 */
export function CustomerLoginPage() {
  const { status, notice, login } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  if (status === "authenticated") return <Navigate to={next} replace />;

  return (
    <main className="page login">
      <h1>로그인</h1>
      <p>대여받을 때 쓴 계정으로 로그인해 주세요.</p>
      {notice && <p role="status">{NOTICE[notice]}</p>}
      <LoginForm onLogin={(email, password) => login(email, password, "CUSTOMER")} />
    </main>
  );
}

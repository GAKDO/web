import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";
import { demoCustomerEmails } from "../../../shared/config/demoAccounts";
import { pendingSignup } from "../../signup/pendingSignup";
import { safeNext } from "../safeNext";

/** 고객 로그인 `/login?next=<돌아올 경로>`. 수령 QR(WE2)·내 렌탈(WE3)이 로그인 뒤 돌아오는 입구 */
export function CustomerLoginPage({ demoEmails = demoCustomerEmails() }: { demoEmails?: string[] }) {
  const { status, notice, login } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"), "/my/rentals");
  // 가입·인증 화면에서 넘어온 이메일(주소에는 넣지 않음)
  const [email, setEmail] = useState(() => pendingSignup.email() ?? "");
  // 이메일 칸을 새로 채우려면 폼을 다시 만든다(데모 계정 고르기)
  const [formKey, setFormKey] = useState(0);
  const [unverified, setUnverified] = useState<string | null>(null);

  if (status === "authenticated") return <Navigate to={next} replace />;

  async function onLogin(address: string, password: string) {
    setUnverified(null);
    try {
      await login(address, password, "CUSTOMER");
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") setUnverified(address);
      throw e;
    }
  }

  return (
    <main className="page login">
      <h1>로그인</h1>
      <p>대여받을 때 쓴 계정으로 로그인해 주세요.</p>
      {params.get("verified") === "1" && <p role="status">메일 인증이 끝났습니다. 로그인해 주세요.</p>}
      {notice && <p role="status">{LOGIN_NOTICE[notice]}</p>}
      {demoEmails.length > 0 && (
        <div className="demo-accounts" role="group" aria-label="시연용 계정">
          {demoEmails.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setEmail(d);
                setFormKey((k) => k + 1);
              }}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <LoginForm key={formKey} initialEmail={email} onLogin={onLogin} />
      {unverified && (
        <p>
          <Link to={`/signup/verify?${new URLSearchParams({ next }).toString()}`} onClick={() => pendingSignup.set(unverified, null)}>
            메일 인증하러 가기
          </Link>
        </p>
      )}
      <p>
        <Link to="/password/reset">비밀번호를 잊으셨나요?</Link>
      </p>
      <p>
        처음이신가요? <Link to={`/signup?${new URLSearchParams({ next }).toString()}`}>회원가입</Link>
      </p>
    </main>
  );
}

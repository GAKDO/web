import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { safeNext } from "../../customer-auth/safeNext";

const failText = (e: unknown, fallback: string) => (e instanceof ApiError && e.status !== 0 ? messageFor(e) : fallback);

/** 메일 인증 `/signup/verify?email=&next=`. 가입 직후면 바로 로그인해 next로, 로그인 화면에서 왔으면 다시 로그인 화면으로 */
export function VerifyEmailPage() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const email = params.get("email") ?? "";
  const next = safeNext(params.get("next"), "/my/rentals");
  const password = (location.state as { password?: string } | null)?.password;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unwrap(api.POST("/api/v1/auth/email/verify", { body: { email, code } }));
    } catch (e) {
      setError(failText(e, "인증하지 못했습니다. 잠시 뒤 다시 시도해 주세요."));
      setBusy(false);
      return;
    }
    const toLogin = `/login?${new URLSearchParams({ next, email, verified: "1" }).toString()}`;
    if (!password) return navigate(toLogin, { replace: true });
    try {
      await login(email, password, "CUSTOMER");
      navigate(next, { replace: true });
    } catch {
      navigate(toLogin, { replace: true });
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await unwrap(api.POST("/api/v1/auth/email/resend", { body: { email } }));
      setNotice("인증 코드를 다시 보냈습니다. 메일함을 확인해 주세요.");
    } catch (e) {
      setError(failText(e, "다시 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요."));
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <main className="page login">
        <h1>메일 인증</h1>
        <p>
          인증할 이메일을 알 수 없습니다. <Link to="/signup">회원가입</Link>부터 다시 해 주세요.
        </p>
      </main>
    );
  }
  return (
    <main className="page login">
      <h1>메일 인증</h1>
      <p>{email}로 보낸 6자리 코드를 입력해 주세요.</p>
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={verify} noValidate>
        <Field
          label="인증 코드"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          error={error}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" busy={busy} disabled={code.length !== 6 || resending}>
          인증하기
        </Button>
      </form>
      <Button busy={resending} disabled={busy} onClick={() => void resend()}>
        코드 다시 받기
      </Button>
    </main>
  );
}

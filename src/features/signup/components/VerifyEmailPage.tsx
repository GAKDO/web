import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { safeNext } from "../../customer-auth/safeNext";
import { looksLikeEmail, pendingSignup } from "../pendingSignup";
import { customerHome } from "../../../shared/config/customerHome";
import { AuthHeading, AuthShell } from "../../../shared/ui/AuthShell";
import { SIGNUP_STEPS } from "./SignupPage";

const failText = (e: unknown, fallback: string) => (e instanceof ApiError && e.status !== 0 ? messageFor(e) : fallback);

/** 인증 실패 문장. 코드가 틀리면 남은 시도를, 다 쓰면 다시 받으라고 알린다(auth-server remainingAttempts) */
function verifyFailText(e: unknown): string {
  if (e instanceof ApiError && e.code === "CODE_INVALID" && e.remainingAttempts !== null) {
    return e.remainingAttempts > 0
      ? `인증 코드가 맞지 않습니다. ${e.remainingAttempts}번 더 시도할 수 있습니다.`
      : "시도 횟수를 다 썼습니다. 코드 다시 받기를 눌러 주세요.";
  }
  return failText(e, "인증하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
}

/** 메일 인증 `/signup/verify?next=`. 가입 직후면 바로 로그인해 next로, 아니면 로그인 화면으로.
 * 이메일은 주소에 넣지 않는다. 메모리에 없으면(새 탭·새로 고침) 직접 입력받는다 */
export function VerifyEmailPage() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => pendingSignup.email() ?? "");
  const [knownEmail] = useState(() => pendingSignup.email() !== null);
  const next = safeNext(params.get("next"), customerHome());
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
      setError(verifyFailText(e));
      setBusy(false);
      return;
    }
    const password = pendingSignup.takePassword();
    pendingSignup.set(email, null);
    const toLogin = `/login?${new URLSearchParams({ next, verified: "1" }).toString()}`;
    if (!password) return navigate(toLogin, { replace: true });
    try {
      await login(email, password, "CUSTOMER");
      pendingSignup.clear();
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
      setNotice("인증 코드를 다시 보냈습니다. 메일함과 스팸함을 확인해 주세요.");
    } catch (e) {
      setError(failText(e, "다시 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요."));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell steps={{ current: 2, labels: SIGNUP_STEPS }}>
      <AuthHeading title="메일 인증">
        {knownEmail ? `${email}로 보낸 6자리 코드를 입력해 주세요.` : "가입한 이메일과 메일로 받은 6자리 코드를 입력해 주세요."}
      </AuthHeading>
      <p className="m-0 mb-4 text-sm text-zinc-400">메일이 보이지 않으면 스팸함(Gmail은 스팸·프로모션)도 확인해 주세요.</p>
      {notice && (
        <p role="status" className="m-0 mb-3 text-sm text-warning">
          {notice}
        </p>
      )}
      <form onSubmit={verify} noValidate>
        {!knownEmail && (
          <Field label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
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
        <Button type="submit" size="lg" className="w-full" busy={busy} disabled={code.length !== 6 || !looksLikeEmail(email) || resending}>
          인증하기
        </Button>
      </form>
      <Button variant="ghost" className="mt-2 w-full text-zinc-300" busy={resending} disabled={busy || !looksLikeEmail(email)} onClick={() => void resend()}>
        코드 다시 받기
      </Button>
    </AuthShell>
  );
}

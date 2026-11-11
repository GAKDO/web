import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { safeNext } from "../../customer-auth/safeNext";
import { ReceiveQrNotice } from "../../customer-auth/ReceiveQrNotice";
import { looksLikeEmail, pendingSignup } from "../pendingSignup";
import { customerHome } from "../../../shared/config/customerHome";
import { AuthHeading, AuthShell } from "../../../shared/ui/AuthShell";

export const SIGNUP_STEPS = ["정보 입력", "메일 인증"];

/** 고객 가입 `/signup?next=`. 수령 QR → 가입 → 메일 인증 → 촬영(WE2 FR-004a). 이메일·비밀번호는 모듈 메모리로만 넘긴다 */
export function SignupPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"), customerHome());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") return <Navigate to={next} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unwrap(api.POST("/api/v1/auth/signup", { body: { name, email, password, privacyAgreed: agreed } }));
      pendingSignup.set(email, password);
      navigate(`/signup/verify?${new URLSearchParams({ next }).toString()}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, null, null));
    } finally {
      setBusy(false);
    }
  }

  const exists = error?.code === "EMAIL_ALREADY_EXISTS";
  const loginHref = `/login?${new URLSearchParams({ next }).toString()}`;
  return (
    <AuthShell
      steps={{ current: 1, labels: SIGNUP_STEPS }}
      topRight={
        <>
          <span className="hidden sm:inline">이미 계정이 있나요? </span>
          <Link to={loginHref} className="font-semibold text-white underline-offset-4 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <AuthHeading title="회원가입">노트북을 받기 전에 계정을 만들어 주세요. 가입한 메일로 6자리 인증 코드를 보내 드려요.</AuthHeading>
      <ReceiveQrNotice next={next} signup />
      <form onSubmit={submit} noValidate>
        <Field label="이름" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="mb-4 flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          개인정보(이름·이메일, 노트북 상태 사진·진단 결과) 수집과 이용에 동의합니다
        </label>
        {error && (
          <p className="m-0 mb-3 text-sm text-destructive" role="alert">
            {error.status === 0 ? "가입하지 못했습니다. 잠시 뒤 다시 시도해 주세요." : messageFor(error)}{" "}
            {exists && (
              <Link to={loginHref} onClick={() => pendingSignup.set(email, null)} className="font-semibold text-white underline underline-offset-4">
                로그인하기
              </Link>
            )}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" busy={busy} disabled={!name || !looksLikeEmail(email) || password.length < 8 || !agreed}>
          가입하고 인증 코드 받기
        </Button>
      </form>
      <p className="m-0 mt-4 text-center text-xs text-zinc-500">메일이 안 오면 스팸함도 확인해 주세요.</p>
    </AuthShell>
  );
}

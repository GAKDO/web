import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { safeNext } from "../../customer-auth/safeNext";

/** 고객 가입 `/signup?next=`. 수령 QR → 가입 → 메일 인증 → 촬영(WE2 FR-002a). 비밀번호는 다음 화면의 자동 로그인에만 쓰고 저장하지 않는다 */
export function SignupPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"), "/my/rentals");
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
      const query = new URLSearchParams({ email, next });
      navigate(`/signup/verify?${query.toString()}`, { state: { password } });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, null, null));
    } finally {
      setBusy(false);
    }
  }

  const exists = error?.code === "EMAIL_ALREADY_EXISTS";
  return (
    <main className="page login">
      <h1>회원가입</h1>
      <p>노트북을 받기 전에 계정을 만들어 주세요. 가입한 메일로 인증 코드를 보냅니다.</p>
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
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          개인정보(이름·이메일, 노트북 상태 사진·진단 결과) 수집과 이용에 동의합니다
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error.status === 0 ? "가입하지 못했습니다. 잠시 뒤 다시 시도해 주세요." : messageFor(error)}{" "}
            {exists && <Link to={`/login?${new URLSearchParams({ next, email }).toString()}`}>로그인하기</Link>}
          </p>
        )}
        <Button type="submit" busy={busy} disabled={!name || !email || password.length < 8 || !agreed}>
          가입하고 인증 코드 받기
        </Button>
      </form>
      <p>
        이미 계정이 있나요? <Link to={`/login?${new URLSearchParams({ next }).toString()}`}>로그인</Link>
      </p>
    </main>
  );
}

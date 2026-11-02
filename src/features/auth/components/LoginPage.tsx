import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type AuthNotice } from "../../../shared/auth/AuthProvider";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";

const NOTICE: Record<Exclude<AuthNotice, null>, string> = {
  expired: "로그인 시간이 지났습니다. 다시 로그인해 주세요.",
  notAdmin: "관리자 전용 화면입니다. 관리자 계정으로 로그인해 주세요.",
};

export function LoginPage() {
  const { status, notice, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") return <Navigate to="/admin/devices" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? messageFor(e) : "로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page login">
      <h1>관리자 로그인</h1>
      {notice && !error && <p role="status">{NOTICE[notice]}</p>}
      <form onSubmit={submit} noValidate>
        <Field label="이메일" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={error}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" busy={busy} disabled={!email || !password}>
          로그인
        </Button>
      </form>
    </main>
  );
}

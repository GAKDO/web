import { useState, type FormEvent } from "react";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";

/** 관리자·고객 로그인 화면이 같이 쓰는 입력 부분. 실패하면 비밀번호 칸만 비운다 */
export function LoginForm({ onLogin }: { onLogin(email: string, password: string): Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? messageFor(e) : "로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}

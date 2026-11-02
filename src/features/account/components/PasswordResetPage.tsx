import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { Button } from "../../../shared/ui/Button";
import { Field } from "../../../shared/ui/Field";
import { requestPasswordReset, resetPassword } from "../api";

type Step = "email" | "code" | "done";

/** 실패 문장. 코드가 틀리면 남은 시도를, 다 쓰면 다시 받으라고 알린다 */
function resetMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  if (error.code === "CODE_INVALID" && error.remainingAttempts !== null) {
    return error.remainingAttempts > 0
      ? `재설정 코드가 맞지 않습니다. ${error.remainingAttempts}번 더 시도할 수 있습니다.`
      : "시도 횟수를 다 썼습니다. 코드를 다시 받아 주세요.";
  }
  if (error.code === "CODE_INVALID") return "재설정 코드가 맞지 않습니다.";
  if (error.code === "CODE_EXPIRED") return "재설정 코드가 만료됐습니다. 코드를 다시 받아 주세요.";
  return messageFor(error);
}

/** 비밀번호 재설정 `/password/reset`(FR-USR-06). 이메일 → 받은 6자리 코드와 새 비밀번호 → 완료 */
export function PasswordResetPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setCode("");
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiError ? messageFor(e) : "코드를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("새 비밀번호가 서로 다릅니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email.trim(), code, password);
      setStep("done");
    } catch (e) {
      setError(resetMessage(e));
      setPassword("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page login">
      <h1>비밀번호 재설정</h1>
      {step === "email" && (
        <form onSubmit={sendCode} noValidate>
          <p>가입한 이메일로 6자리 재설정 코드를 보내 드립니다.</p>
          <Field label="이메일" type="email" autoComplete="username" required value={email} error={error} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" busy={busy} disabled={!email.trim()}>
            코드 받기
          </Button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={submit} noValidate>
          {/* 계정이 있는지 드러내지 않도록 늘 같은 문장 */}
          <p role="status">{email.trim()}이(가) 가입된 이메일이면 재설정 코드를 보냈습니다. 메일함을 확인해 주세요.</p>
          <Field
            label="재설정 코드(6자리)"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Field label="새 비밀번호" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            error={error}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" busy={busy} disabled={code.length !== 6 || !password || !confirm}>
            비밀번호 바꾸기
          </Button>
          <Button type="button" disabled={busy} onClick={() => void sendCode()}>
            코드 다시 받기
          </Button>
        </form>
      )}
      {step === "done" && (
        <>
          <p role="status">비밀번호를 바꿨습니다. 다른 기기의 로그인도 모두 끝났습니다.</p>
          <Link className="button-link" to="/login">
            새 비밀번호로 로그인
          </Link>
        </>
      )}
      {step !== "done" && (
        <p>
          <Link to="/login">로그인으로 돌아가기</Link>
        </p>
      )}
    </main>
  );
}

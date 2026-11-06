import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { Field } from "../../../shared/ui/Field";
import { withdraw } from "../api";
import { customerHome } from "../../../shared/config/customerHome";

/** 계정 탈퇴 `/my/account/withdraw`(FR-USR-04). 비밀번호를 확인하고 한 번 더 물은 뒤 탈퇴한다 */
export function WithdrawPage() {
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function ask(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAsking(true);
  }

  async function confirm() {
    setBusy(true);
    try {
      await withdraw(password);
      // 서버가 계정과 리프레시 토큰을 이미 지웠으므로 로그아웃 요청 없이 화면 세션만 지운다
      clearSession();
      navigate("/account/withdrawn", { replace: true });
    } catch (e) {
      setAsking(false);
      setPassword("");
      setError(
        e instanceof ApiError && e.code === "INVALID_CREDENTIALS"
          ? "비밀번호가 맞지 않습니다."
          : e instanceof ApiError
            ? messageFor(e)
            : "탈퇴하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1>계정 탈퇴</h1>
      <ul>
        <li>이메일·이름·비밀번호가 지워지고 다시 로그인할 수 없습니다.</li>
        <li>렌탈 기록(사진·검사·진단·봉인)은 지워지지 않고 남습니다.</li>
      </ul>
      <form onSubmit={ask} noValidate>
        <Field
          label="비밀번호 확인"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={error}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" className="danger" disabled={!password || asking}>
          탈퇴하기
        </Button>
      </form>
      {asking && (
        <ConfirmDialog message="정말 탈퇴할까요? 되돌릴 수 없습니다." confirmLabel="탈퇴" busy={busy} onConfirm={() => void confirm()} onCancel={() => setAsking(false)} />
      )}
      <p>
        <Link to={customerHome()}>{customerHome() === "/my/rentals" ? "내 렌탈로 돌아가기" : "내 계정으로 돌아가기"}</Link>
      </p>
    </main>
  );
}

/** 탈퇴 뒤 안내(로그인 없이 연다) */
export function WithdrawnPage() {
  return (
    <main className="page narrow">
      <h1>탈퇴했습니다</h1>
      <p role="status">계정 정보를 지웠습니다. 그동안 이용해 주셔서 감사합니다.</p>
      <Link to="/">처음으로</Link>
    </main>
  );
}

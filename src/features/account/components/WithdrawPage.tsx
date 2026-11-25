import { useState, type FormEvent } from "react";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { Field } from "../../../shared/ui/Field";
import { useMe, withdraw } from "../api";
import { customerHome } from "../../../shared/config/customerHome";

/** 탈퇴 확인 문구. 비밀번호를 정한 적 없는 소셜 가입 계정은 비밀번호 대신 이 낱말을 입력한다 */
const CONFIRM_WORD = "탈퇴";

/**
 * 계정 탈퇴 `/my/account/withdraw`(FR-USR-04). 비밀번호를 확인하고 한 번 더 물은 뒤 탈퇴한다.
 * 비밀번호를 정한 적 없는 소셜 가입 계정(`passwordSet` false)은 "탈퇴"를 입력해 확인한다(11/12 팀 결정).
 * 서버는 이때 로그인한 지 10분 안인 세션만 받고, 지났으면 403 REAUTH_REQUIRED라 다시 로그인하게 안내한다.
 * 비밀번호로 가입한 뒤 소셜이 자동 연결된 계정은 계속 비밀번호를 묻는다.
 */
export function WithdrawPage() {
  const { clearSession, logout } = useAuth();
  const navigate = useNavigate();
  const me = useMe();
  const social = me.data?.passwordSet === false;
  const [password, setPassword] = useState("");
  const ready = social ? password.trim() === CONFIRM_WORD : password.length > 0;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  function ask(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setReauth(false);
    setAsking(true);
  }

  async function confirm() {
    setBusy(true);
    try {
      await withdraw(social ? undefined : password);
      // 서버가 계정과 리프레시 토큰을 이미 지웠으므로 로그아웃 요청 없이 화면 세션만 지운다
      clearSession();
      navigate("/account/withdrawn", { replace: true });
    } catch (e) {
      setAsking(false);
      setPassword("");
      if (e instanceof ApiError && e.code === "REAUTH_REQUIRED") {
        setReauth(true);
        return;
      }
      setError(
        e instanceof ApiError && e.code === "INVALID_CREDENTIALS"
          ? social
            ? "탈퇴를 확인하지 못했습니다. 다시 시도해 주세요."
            : "비밀번호가 맞지 않습니다."
          : e instanceof ApiError
            ? messageFor(e)
            : "탈퇴하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function relogin() {
    await logout();
    navigate(`/login?next=${encodeURIComponent("/my/account/withdraw")}`, { replace: true });
  }

  const back = customerHome() === "/my/rentals" ? "마이페이지로 돌아가기" : "내 정보로 돌아가기";
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-8 md:py-10">
      <Link
        to={customerHome()}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {back}
      </Link>
      <h1 className="m-0 mt-2 text-2xl font-bold tracking-tight">계정 탈퇴</h1>
      <section className="mt-6 rounded-2xl border border-destructive/30 bg-card p-5 shadow-xs md:p-6">
        <ul className="m-0 grid list-none gap-2 p-0 text-sm">
          <li className="flex gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            이메일·이름·비밀번호가 지워지고 다시 로그인할 수 없습니다.
          </li>
          <li className="flex gap-2">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            렌탈 기록(사진·검사·진단·봉인)은 지워지지 않고 남습니다.
          </li>
        </ul>
        {social && (
          <p className="m-0 mt-4 text-sm text-muted-foreground">
            소셜 로그인으로 가입한 계정이라 비밀번호 대신 아래 칸에 <strong className="text-foreground">{CONFIRM_WORD}</strong>를
            입력해 확인합니다. 보안을 위해 로그인한 지 10분 안에만 탈퇴할 수 있고, 소셜 로그인 연결도 함께 끊깁니다.
          </p>
        )}
        {reauth && (
          <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="m-0">로그인한 지 10분이 지났습니다. 보안을 위해 다시 로그인한 뒤 탈퇴해 주세요.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void relogin()}>
              다시 로그인
            </Button>
          </div>
        )}
        <form onSubmit={ask} noValidate className="mt-5">
          <Field
            label={social ? `확인을 위해 "${CONFIRM_WORD}" 입력` : "비밀번호 확인"}
            type={social ? "text" : "password"}
            autoComplete={social ? "off" : "current-password"}
            required
            value={password}
            error={error}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
              setReauth(false);
            }}
          />
          <Button type="submit" variant="destructive" className="mt-2" disabled={!ready || asking || me.isPending}>
            탈퇴하기
          </Button>
        </form>
      </section>
      {asking && (
        <ConfirmDialog message="정말 탈퇴할까요? 되돌릴 수 없습니다." confirmLabel="탈퇴" busy={busy} onConfirm={() => void confirm()} onCancel={() => setAsking(false)} />
      )}
    </main>
  );
}

/** 탈퇴 뒤 안내(로그인 없이 연다) */
export function WithdrawnPage() {
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-md content-center justify-items-start gap-3 px-4 py-10">
      <h1 className="m-0 text-2xl font-bold tracking-tight">탈퇴했습니다</h1>
      <p role="status" className="m-0 text-sm text-muted-foreground">
        계정 정보를 지웠습니다. 그동안 이용해 주셔서 감사합니다.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "no-underline")}>
        처음으로
      </Link>
    </main>
  );
}

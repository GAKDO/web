import { useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthDivider, AuthHeading, AuthShell } from "../../../shared/ui/AuthShell";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";
import { demoCustomerEmails } from "../../../shared/config/demoAccounts";
import { isArchived } from "../../../shared/config/features";
import { pendingSignup } from "../../signup/pendingSignup";
import { safeNext } from "../safeNext";
import { ReceiveQrNotice } from "../ReceiveQrNotice";
import { customerHome } from "../../../shared/config/customerHome";

/**
 * 로그인 `/login?next=<돌아올 경로>`. 사이트의 기본 로그인 입구(고객이 먼저 보이게)이고, 관리자 계정도 여기서 로그인한다.
 * next가 없으면 관리자는 관리자 화면, 고객은 내 계정으로 간다. 수령 QR(WE2)·내 렌탈(WE3)은 next로 돌아온다
 */
export function CustomerLoginPage({ demoEmails = demoCustomerEmails() }: { demoEmails?: string[] }) {
  const { status, role, notice, login } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"), customerHome());
  // next를 주지 않고 관리자로 로그인하면 관리자 화면으로 보낸다
  const target = !params.get("next") && role === "ADMIN" ? "/admin/devices" : next;
  // 가입·인증 화면에서 넘어온 이메일(주소에는 넣지 않음)
  const [email, setEmail] = useState(() => pendingSignup.email() ?? "");
  // 이메일 칸을 새로 채우려면 폼을 다시 만든다(데모 계정 고르기)
  const [formKey, setFormKey] = useState(0);
  const [unverified, setUnverified] = useState<string | null>(null);
  const accountArchived = isArchived("account");

  if (status === "authenticated") return <Navigate to={target} replace />;

  async function onLogin(address: string, password: string) {
    setUnverified(null);
    try {
      await login(address, password, "CUSTOMER");
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") setUnverified(address);
      throw e;
    }
  }

  const signupHref = `/signup?${new URLSearchParams({ next }).toString()}`;
  return (
    <AuthShell
      topRight={
        !accountArchived && (
          <>
            <span className="hidden sm:inline">처음이신가요? </span>
            <Link to={signupHref} className="font-semibold text-white underline-offset-4 hover:underline">
              회원가입
            </Link>
          </>
        )
      }
    >
      <AuthHeading title="로그인">렌탈받을 때 쓴 이메일로 로그인하세요. 관리자 계정도 여기서 로그인합니다.</AuthHeading>
      <ReceiveQrNotice next={next} />
      <div className="grid gap-2 empty:hidden">
        {params.get("verified") === "1" && <Notice>메일 인증이 끝났습니다. 로그인해 주세요.</Notice>}
        {notice && <Notice>{LOGIN_NOTICE[notice]}</Notice>}
        {params.get("loggedOut") === "partial" && (
          <p role="alert" className="m-0 mb-3 text-sm text-warning">
            이 화면에서는 로그아웃했지만 서버에 알리지 못했습니다. 공용 PC라면 브라우저를 모두 닫아 주세요.
          </p>
        )}
      </div>
      {demoEmails.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="시연용 계정">
          {demoEmails.map((d) => (
            <button
              key={d}
              type="button"
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10"
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
      {unverified && !accountArchived && (
        <p className="m-0 mt-3 text-sm">
          <Link
            to={`/signup/verify?${new URLSearchParams({ next }).toString()}`}
            onClick={() => pendingSignup.set(unverified, null)}
            className="font-semibold text-white underline underline-offset-4"
          >
            메일 인증하러 가기
          </Link>
        </p>
      )}
      {/* 가입·메일 인증·비밀번호 재설정(AU2)은 보관(account)하면 숨긴다. 시연 계정은 A가 미리 만든다 */}
      {!accountArchived && (
        <>
          <p className="m-0 mt-3 text-right text-sm">
            <Link to="/password/reset" className="text-zinc-300 underline-offset-4 hover:text-white hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
          </p>
          <AuthDivider>처음이신가요?</AuthDivider>
          <Link to={signupHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            이메일로 회원가입
          </Link>
        </>
      )}
    </AuthShell>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 mb-3 text-sm text-warning">
      {children}
    </p>
  );
}

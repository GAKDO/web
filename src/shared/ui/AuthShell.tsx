import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TraceLogo } from "./TraceLogo";

interface AuthShellProps {
  /** 위쪽 오른쪽(예: "처음이신가요? 회원가입") */
  topRight?: ReactNode;
  /** 가입 단계 막대: [지금 단계(1부터), 단계 이름들] */
  steps?: { current: number; labels: string[] };
  children: ReactNode;
}

/**
 * 고객 로그인·회원가입·메일 인증·비밀번호 재설정이 같이 쓰는 틀.
 * 첫 화면과 같은 어두운 바탕 위에 유리 카드 하나만 두고, 관리자 입구는 맨 아래 작은 링크로만 둔다(고객이 먼저 보이게)
 */
export function AuthShell({ topRight, steps, children }: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-sidebar text-white">
      {/* 장식: 격자 무늬 + 빨간 빛(읽는 내용 없음) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]"
      />
      <div aria-hidden="true" className="absolute -top-32 -left-24 -z-10 size-[30rem] rounded-full bg-brand/30 blur-[140px]" />
      <div aria-hidden="true" className="absolute right-[-6rem] bottom-[-8rem] -z-10 size-[28rem] rounded-full bg-brand/15 blur-[140px]" />
      <header className="mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-4 md:px-8">
        <Link to="/" aria-label="TRACE 첫 화면" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <TraceLogo className="h-9 md:h-11" />
        </Link>
        {topRight && <div className="text-sm text-zinc-400">{topRight}</div>}
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-3">
        <Card className="surface-dark w-full max-w-[26rem] animate-enter gap-0 border-white/10 px-6 py-6 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl md:px-7">
          {steps && <StepBar {...steps} />}
          {children}
        </Card>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-3 text-xs text-zinc-500 md:px-8">
        <span>TRACE Rental Management System</span>
        <Link to="/admin/login" className="text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
          관리자 로그인
        </Link>
      </footer>
    </div>
  );
}

function StepBar({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="mb-5">
      <div className="flex gap-2" aria-hidden="true">
        {labels.map((label, i) => (
          <span key={label} className={cn("h-1 flex-1 rounded-full", i < current ? "bg-brand" : "bg-white/12")} />
        ))}
      </div>
      <ol className="m-0 mt-2 flex list-none justify-between p-0 text-xs text-zinc-400">
        {labels.map((label, i) => (
          <li key={label} aria-current={i + 1 === current ? "step" : undefined} className={cn(i + 1 === current && "font-semibold text-white")}>
            {i + 1} {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 카드 위 제목·설명 */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="m-0 text-2xl font-bold tracking-tight">{title}</h1>
      {children && <p className="m-0 mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}

/** 카드 안 "또는" 구분선 */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-zinc-500 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">
      {children}
    </div>
  );
}

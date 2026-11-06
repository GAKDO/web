import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, CircleCheck, CircleX, Mail, QrCode, ScanSearch, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TraceLogo } from "../../../shared/ui/TraceLogo";
import { isArchived } from "../../../shared/config/features";
import { customerHome } from "../../../shared/config/customerHome";
import { useAuth } from "../../../shared/auth/AuthProvider";

const STEPS = [
  { icon: Store, title: "창구에서 대여", text: "렌탈 창구에서 빌릴 노트북을 정하면 직원이 렌탈을 만들고 기기를 연결합니다." },
  { icon: Camera, title: "출고 검사", text: "내보내기 전에 부스에서 윗면·바닥을 카메라 2대, 조명 3개로 12장 찍고 흠집을 찾아 둡니다." },
  { icon: QrCode, title: "QR로 내 계정에 연결", text: "받을 때 직원이 보여 주는 QR을 폰 카메라로 찍고 로그인하면 그 렌탈이 내 계정에 연결됩니다." },
  { icon: ScanSearch, title: "반납 비교", text: "돌려줄 때 다시 찍어 처음 사진과 비교하고, 새로 생긴 흠집만 따집니다." },
];

const FAQ = [
  {
    q: "원래 있던 흠집 때문에 돈을 물게 되지 않나요?",
    a: "출고 검사 사진이 기준입니다. 반납 때는 그 사진과 비교해 새로 생긴 흠집만 표시하므로, 처음부터 있던 흠집은 따로 구분됩니다.",
  },
  {
    q: "업체가 나중에 기록을 고치면요?",
    a: "검사 기록은 시점마다 봉인되고, 봉인된 기록의 지문(해시)을 메일로 보내 드립니다. 리포트의 검증 링크에서 같은 지문인지 누구나 확인할 수 있습니다.",
  },
  {
    q: "QR을 찍었는데 내 렌탈이 비어 있어요.",
    a: "로그인한 계정으로 QR을 다시 열어 주세요. 이미 다른 계정에 연결된 렌탈은 연결되지 않으니, 그럴 때는 창구에 알려 주세요.",
  },
];

/**
 * 고객 이용 안내(11/6). TRACE는 판매 사이트가 아니라 빌린 노트북 상태를 기록하는 서비스라서,
 * 대여는 창구에서 하고 고객은 QR로 렌탈을 계정에 연결한다는 흐름과 판정·기록 기준을 보여 준다.
 * 고객용 기기 목록 API가 계약에 없어 기기 목록은 넣지 않는다(목록·가짜 데이터 없음)
 */
export function GuidePage() {
  const showAccount = !isArchived("account");
  const { status, role } = useAuth();
  const signedIn = status === "authenticated";
  const myHome = role === "ADMIN" ? "/admin/devices" : customerHome();
  const myHomeLabel = role === "ADMIN" ? "관리자 화면" : myHome === "/my/rentals" ? "내 렌탈" : "내 계정";
  return (
    <div className="min-h-svh bg-background">
      <section className="relative isolate overflow-hidden bg-sidebar text-white">
        <div aria-hidden="true" className="absolute -top-32 left-1/2 -z-10 size-[32.5rem] -translate-x-1/2 rounded-full bg-brand/25 blur-[140px]" />
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link to="/" aria-label="TRACE 첫 화면" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <TraceLogo className="h-11" />
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="이동">
            {signedIn ? (
              <Link to={myHome} className={buttonVariants({ size: "sm" })}>
                {myHomeLabel}
              </Link>
            ) : showAccount ? (
              <Link to="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-300 hover:bg-white/10 hover:text-white")}>
                로그인
              </Link>
            ) : null}
          </nav>
        </header>
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-14 md:px-8 md:pt-12 md:pb-20">
          <h1 className="stagger m-0 animate-enter text-[2rem] leading-[1.2] font-bold tracking-tight md:text-[2.75rem]" style={{ "--i": 0 } as CSSProperties}>
            TRACE로 노트북 빌리는 방법
          </h1>
          <p className="stagger mt-4 mb-0 max-w-xl animate-enter text-[0.9375rem] leading-relaxed text-zinc-400 md:text-base" style={{ "--i": 1 } as CSSProperties}>
            빌린 노트북의 상태를 내보낼 때와 돌려받을 때 부스 사진으로 남깁니다. 원래 있던 흠집으로 책임을 지는 일이 없도록, 기록은 고객도 함께 봅니다.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <h2 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">대여부터 반납까지</h2>
        <ol aria-label="대여 순서" className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="stagger animate-enter rounded-2xl border bg-card p-5 shadow-xs" style={{ "--i": i + 2 } as CSSProperties}>
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 mb-1 text-base font-semibold">
                <span className="mr-2 text-muted-foreground tabular-nums">0{i + 1}</span>
                {title}
              </h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 mb-0 text-2xl font-bold tracking-tight md:text-3xl">상태는 이렇게 판정해요</h2>
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-4">
          <li className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-5">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
            <span>
              <strong className="text-success">문제 없음 · 등급 A</strong>
              <span className="mt-1 block text-sm text-muted-foreground">외관에 수리할 흠집이 없습니다.</span>
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-5">
            <CircleX aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
            <span>
              <strong className="text-destructive">문제 있음 · 등급 B~D</strong>
              <span className="mt-1 block text-sm text-muted-foreground">긁힘·찍힘이 있어 수리가 필요합니다. 리포트에서 사진 위 흠집 위치를 볼 수 있습니다.</span>
            </span>
          </li>
        </ul>

        <section aria-labelledby="sealed" className="mt-14 flex items-start gap-4 rounded-2xl border bg-card p-5 md:p-7">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Mail className="size-5" />
          </span>
          <div>
            <h2 id="sealed" className="m-0 text-lg font-bold">기록은 업체도 고칠 수 없어요</h2>
            <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">
              시점마다 검사 기록을 봉인하고 그 지문을 메일로 보내 드립니다. 메일은 업체가 고칠 수 없으니, 검증 페이지의 지문과 같으면 봉인 뒤 바뀌지 않은 기록입니다.
            </p>
          </div>
        </section>

        <h2 className="mt-14 mb-0 text-2xl font-bold tracking-tight md:text-3xl">자주 묻는 질문</h2>
        <div className="mt-6 grid gap-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border bg-card p-5 open:shadow-xs">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
              <p className="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>

        {(showAccount || signedIn) && (
          <div className="mt-14 flex flex-col items-start gap-3 rounded-2xl bg-sidebar p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <p className="m-0 text-base font-semibold md:text-lg">
              {signedIn ? "연결된 렌탈의 검사 기록을 확인해 보세요." : "가입해 두면 QR 한 번으로 렌탈이 내 계정에 연결돼요."}
            </p>
            <Link to={signedIn ? myHome : "/signup"} className={cn(buttonVariants({ size: "lg" }), "group shrink-0")}>
              {signedIn ? `${myHomeLabel} 열기` : "회원가입하기"}
              <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

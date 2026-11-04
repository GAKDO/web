import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, CircleCheck, CircleX, ScanSearch, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanVisual } from "../../../shared/ui/ScanVisual";

const STEPS = [
  { icon: Camera, title: "부스 촬영", text: "기기를 부스에 올리면 윗면·바닥을 카메라 2대, 조명 3개로 12장 찍습니다." },
  { icon: ScanSearch, title: "흠집 판정", text: "부스가 사진에서 긁힘·찍힘을 찾고, 서버가 등급을 매깁니다." },
  { icon: ShieldCheck, title: "결과 확인", text: "관리자 화면에서 사진 위 흠집 위치와 문제 있음·없음을 봅니다." },
];

/**
 * 첫 화면(gakdo.site). MVP(11/3)는 관리자만 쓰므로 들어가는 곳은 관리자 로그인 하나다(고객 가입·폰 촬영은 11/10 뒤).
 * 어두운 첫 칸에 검사 막대 그림, 아래에 세 단계와 판정 기준. 내용은 순서대로 살짝 떠오르며 나타난다
 */
export function HomePage() {
  return (
    <div className="min-h-svh bg-background">
      <section className="relative isolate overflow-hidden bg-sidebar text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        />
        <div aria-hidden="true" className="absolute -top-32 left-1/2 -z-10 size-[520px] -translate-x-1/2 rounded-full bg-brand/30 blur-[140px]" />
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <span className="inline-flex items-center gap-2.5">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand font-black shadow-[0_0_24px_-4px_var(--brand)]">
              T
            </span>
            <h1 className="m-0 text-lg font-bold tracking-[0.12em]">TRACE</h1>
          </span>
          <Link to="/admin/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-300 hover:bg-white/10 hover:text-white")}>
            관리자 로그인
          </Link>
        </header>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 md:grid-cols-[1.1fr_1fr] md:px-8 md:pt-16 md:pb-24">
          <div>
            <p className="stagger m-0 inline-flex animate-enter items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300" style={{ "--i": 0 } as CSSProperties}>
              <span className="size-1.5 rounded-full bg-brand" />
              렌탈 노트북 검사 · 관리
            </p>
            <p className="stagger mt-5 mb-4 animate-enter text-[34px] leading-[1.15] font-bold tracking-tight md:text-[52px]" style={{ "--i": 1 } as CSSProperties}>
              노트북 상태를
              <br />
              <span className="bg-gradient-to-r from-brand to-[#ff5a5f] bg-clip-text text-transparent">투명하게</span>, 정확하게
            </p>
            <p className="stagger m-0 max-w-md animate-enter text-[15px] leading-relaxed text-zinc-400 md:text-base" style={{ "--i": 2 } as CSSProperties}>
              빌려주기 전과 돌려받은 뒤, 부스에서 찍은 사진으로 흠집을 찾아 기록합니다. 누가 봐도 같은 결과를 사진과 함께 남깁니다.
            </p>
            <div className="stagger mt-8 flex animate-enter flex-wrap gap-3" style={{ "--i": 3 } as CSSProperties}>
              <Link to="/admin/login" className={cn(buttonVariants({ size: "lg" }), "group shadow-[0_8px_30px_-8px_var(--brand)]")}>
                관리자 화면 열기
                <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
          <ScanVisual className="mx-auto max-w-[460px]" />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <h2 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">이렇게 검사합니다</h2>
        <ol className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-3 md:gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="stagger group animate-enter rounded-2xl border bg-card p-5 shadow-xs transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
              style={{ "--i": i + 4 } as CSSProperties}
            >
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition-colors duration-200 group-hover:bg-brand group-hover:text-white">
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

        <h2 className="mt-14 mb-0 text-2xl font-bold tracking-tight md:text-3xl">판정 기준</h2>
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-4">
          <li className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-5">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
            <span>
              <strong className="text-success">문제 없음 · 등급 A</strong>
              <span className="mt-1 block text-sm text-muted-foreground">수리 필요 없음</span>
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-5">
            <CircleX aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
            <span>
              <strong className="text-destructive">문제 있음 · 등급 B~D</strong>
              <span className="mt-1 block text-sm text-muted-foreground">수리 필요</span>
            </span>
          </li>
        </ul>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">TRACE Rental Management System</footer>
    </div>
  );
}

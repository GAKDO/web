import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, CircleX, FileCheck2, Laptop, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAQ, STEPS } from "../../guide/content";

const VALUES = [
  { icon: ShieldCheck, title: "원래 있던 흠집은 내 책임이 아니에요", text: "내보내기 전 부스 사진이 기준이라, 처음부터 있던 흠집은 따로 구분됩니다." },
  { icon: Sparkles, title: "새로 생긴 흠집만 비교해요", text: "반납 때 처음 사진과 맞대어 새 흠집만 표시하니 다툴 일이 줄어듭니다." },
  { icon: Lock, title: "기록은 업체도 못 고쳐요", text: "시점마다 봉인하고 지문을 메일로 보내 드립니다. 검증 페이지에서 누구나 확인해요." },
  { icon: Laptop, title: "내 노트북을 한눈에", text: "마이페이지에서 빌린 기종의 사양과 출고·수령·반납 검사 결과를 봅니다." },
];

const MYPAGE = ["빌린 노트북의 사양(프로세서·메모리·저장 공간)", "출고·수령·반납 단계별 등급", "사진 위 흠집 위치와 새 흠집 표시", "봉인 기록 검증 링크"];

const SECTION = "mx-auto max-w-6xl px-4 md:px-8";
const H2 = "m-0 text-2xl font-bold tracking-tight md:text-3xl";

/**
 * 고객 계정·리포트가 보이는 배포의 첫 화면 본문(11/6). 렌탈 서비스 첫 화면처럼 장점 → 이용 흐름 → 마이페이지 → 판정 기준 → 자주 묻는 질문 → 가입 순서.
 * 기기 목록(라인업)은 고객용 카탈로그 API가 계약에 생기면 붙인다(가짜 목록을 넣지 않음)
 */
export function CustomerSections({ signedIn, myHome, myHomeLabel }: { signedIn: boolean; myHome: string; myHomeLabel: string }) {
  return (
    <main>
      <section aria-labelledby="values" className={cn(SECTION, "py-14 md:py-20")}>
        <p className="m-0 text-sm font-semibold text-brand">왜 TRACE인가요</p>
        <h2 id="values" className={cn(H2, "mt-2")}>
          빌릴 때도, 돌려줄 때도 마음 편하게
        </h2>
        <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          {VALUES.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="stagger animate-enter rounded-2xl border bg-card p-5 shadow-xs transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:translate-none"
              style={{ "--i": i + 4 } as CSSProperties}
            >
              <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 mb-1 text-base font-semibold break-keep">{title}</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="flow" className="border-y bg-card/60 py-14 md:py-20">
        <div className={SECTION}>
          <p className="m-0 text-sm font-semibold text-brand">이용 방법</p>
          <h2 id="flow" className={cn(H2, "mt-2")}>
            대여부터 반납까지 4단계
          </h2>
          <ol className="m-0 mt-8 grid list-none gap-3 p-0 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border bg-background p-5">
                <span className="absolute top-5 right-5 text-3xl font-bold text-muted-foreground/25 tabular-nums" aria-hidden="true">
                  0{i + 1}
                </span>
                <Icon aria-hidden="true" className="size-6 text-brand" />
                <h3 className="mt-4 mb-1 text-base font-semibold">
                  <span className="sr-only">{i + 1}단계 </span>
                  {title}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <Link to="/guide" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold">
            이용 안내 자세히 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="mypage" className={cn(SECTION, "grid items-center gap-8 py-14 md:grid-cols-2 md:py-20")}>
        <div>
          <p className="m-0 text-sm font-semibold text-brand">마이페이지</p>
          <h2 id="mypage" className={cn(H2, "mt-2")}>
            가입하면 이런 걸 볼 수 있어요
          </h2>
          <p className="m-0 mt-3 text-muted-foreground">렌탈을 계정에 연결하면 검사가 끝날 때마다 결과가 쌓입니다.</p>
        </div>
        <ul className="m-0 grid list-none gap-2 p-0">
          {MYPAGE.map((item) => (
            <li key={item} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <FileCheck2 aria-hidden="true" className="size-5 shrink-0 text-success" />
              <span className="text-sm font-medium">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="grade" className={cn(SECTION, "pb-14 md:pb-20")}>
        <h2 id="grade" className={H2}>
          판정 기준
        </h2>
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
              <span className="mt-1 block text-sm text-muted-foreground">긁힘·찍힘이 있어 수리가 필요합니다.</span>
            </span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="faq" className={cn(SECTION, "pb-14 md:pb-20")}>
        <h2 id="faq" className={H2}>
          자주 묻는 질문
        </h2>
        <div className="mt-6 grid gap-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="rounded-2xl border bg-card p-5 open:shadow-xs">
              <summary className="cursor-pointer font-semibold">{q}</summary>
              <p className="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta" className={cn(SECTION, "pb-16 md:pb-24")}>
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-sidebar p-7 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <h2 id="cta" className="m-0 text-xl font-bold md:text-2xl">
              {signedIn ? "내 노트북 기록을 확인해 보세요" : "지금 가입하고 렌탈을 연결하세요"}
            </h2>
            <p className="m-0 mt-1 text-sm text-zinc-400">QR 한 번이면 빌린 노트북이 내 계정에 연결돼요.</p>
          </div>
          <Link to={signedIn ? myHome : "/signup"} className={cn(buttonVariants({ size: "lg" }), "group shrink-0")}>
            {signedIn ? `${myHomeLabel} 열기` : "회원가입하기"}
            <ArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </main>
  );
}

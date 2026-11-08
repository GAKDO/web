import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { GRADE_NOTES, GRADES, GUIDE_FAQ, STAGES, VERIFY_STEPS, type Actor, type GuideStage } from "../content";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "../../../shared/ui/Reveal";
import { SiteHeader } from "../../../shared/ui/SiteHeader";
import { isArchived } from "../../../shared/config/features";
import { customerHome } from "../../../shared/config/customerHome";
import { useAuth } from "../../../shared/auth/AuthProvider";

const SECTIONS = [
  { id: "overview", label: "세 번의 기록" },
  { id: "steps", label: "단계별 안내" },
  { id: "grade", label: "판정 기준" },
  { id: "verify", label: "기록 확인" },
  { id: "faq", label: "자주 묻는 질문" },
];

/** 고정 헤더(3.5rem)에 앵커 제목이 가리지 않게 */
const ANCHOR = "scroll-mt-24";
const H2 = "m-0 text-headline font-bold";

const ACTOR_STYLE: Record<Actor, string> = {
  고객: "bg-brand/10 text-brand",
  직원: "bg-foreground/[0.07] text-foreground",
  TRACE: "bg-success/10 text-success",
};

/**
 * 고객 이용 안내(11/6, 11/8 자세히). 첫 화면은 4단계 요약만 두고, 여기서는 단계마다 누가 어디서 무엇을 하는지,
 * 수령 QR 하나로 로그인하면 렌탈이 연결되는 흐름, 등급 규칙(grade-rules-v1), 봉인 지문 확인 방법을 자세히 보인다.
 * 라우트에서 report를 보관하면 이 화면도 숨기므로(App.tsx), 여기 안내하는 QR 연결·검증 페이지·내 렌탈은 항상 열린다.
 * 고객용 기기 목록 API가 계약에 없어 기기 목록은 넣지 않는다(목록·가짜 데이터 없음)
 */
export function GuidePage() {
  const showAccount = !isArchived("account");
  // 폰 촬영을 숨긴 배포에서는 수령 QR이 계정 연결만 한다
  const phoneCapture = !isArchived("phoneCapture");
  const { status, role } = useAuth();
  const signedIn = status === "authenticated";
  const myHome = role === "ADMIN" ? "/admin/devices" : customerHome();
  const myHomeLabel = role === "ADMIN" ? "관리자 화면" : myHome === "/my/rentals" ? "마이페이지" : "내 정보";
  // 고객 가입을 숨긴 배포에서는 가입 단계와 가입 안내 줄을 뺀다
  const stages = STAGES.filter((s) => showAccount || s.id !== "prepare")
    .map((s) => (!phoneCapture && s.claimOnly ? { ...s, ...s.claimOnly } : s))
    .map((s) => ({ ...s, actions: s.actions.filter((a) => showAccount || !a.accountOnly) }));
  const moments = [
    { name: "출고", where: "검사 부스", who: "직원이 부스로 촬영", what: "이후 모든 비교의 기준선" },
    phoneCapture
      ? { name: "수령", where: "창구에서 내 폰", who: "고객이 폰으로 촬영", what: "받은 그대로의 상태를 내 손으로" }
      : { name: "수령", where: "창구에서 내 폰", who: "고객이 QR로 로그인", what: "렌탈이 내 계정에 연결" },
    { name: "반납", where: "검사 부스", who: "직원이 부스로 촬영", what: "출고 사진과 비교해 새 흠집만" },
  ];

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <section className="bg-sidebar text-white">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 md:px-8 md:pt-24 md:pb-24">
          <h1 className="stagger m-0 max-w-[14ch] animate-enter text-display font-bold" style={{ "--i": 0 } as CSSProperties}>
            TRACE로 노트북 빌리는 방법
          </h1>
          <p className="stagger mt-6 mb-0 max-w-xl animate-enter text-lead text-zinc-400" style={{ "--i": 1 } as CSSProperties}>
            빌린 노트북의 상태를 내보낼 때, 받을 때, 돌려줄 때 사진으로 남깁니다. 원래 있던 흠집으로 책임을 지는 일이 없도록, 기록은 고객도 함께 봅니다.
          </p>
          <nav aria-label="이 페이지 목차" className="stagger mt-10 animate-enter" style={{ "--i": 2 } as CSSProperties}>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  <Link
                    to={{ hash: id }}
                    className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-sm text-zinc-300 no-underline transition-colors hover:border-white/40 hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <section id="overview" aria-labelledby="overview-title" className={ANCHOR}>
          <Reveal as="h2" id="overview-title" className={H2}>
            세 번의 기록
          </Reveal>
          <p className="m-0 mt-4 max-w-[52ch] text-lead text-muted-foreground">렌탈 하나에 기록이 세 번 남고, 시점마다 따로 봉인됩니다.</p>
          <ol aria-label="세 시점" className="m-0 mt-10 grid list-none gap-x-8 gap-y-8 p-0 md:grid-cols-3">
            {moments.map((m, i) => (
              <Reveal as="li" key={m.name} index={i} className="border-t-2 border-foreground pt-5">
                <h3 className="m-0 text-title font-bold">{m.name}</h3>
                <dl className="m-0 mt-4 grid grid-cols-[4.5rem_1fr] gap-y-2 text-[0.9375rem]">
                  <dt className="text-muted-foreground">어디서</dt>
                  <dd className="m-0">{m.where}</dd>
                  <dt className="text-muted-foreground">어떻게</dt>
                  <dd className="m-0">{m.who}</dd>
                  <dt className="text-muted-foreground">의미</dt>
                  <dd className="m-0">{m.what}</dd>
                </dl>
              </Reveal>
            ))}
          </ol>
        </section>

        <section id="steps" aria-labelledby="steps-title" className={cn(ANCHOR, "mt-24 md:mt-32")}>
          <Reveal as="h2" id="steps-title" className={H2}>
            단계별 안내
          </Reveal>
          <p className="m-0 mt-4 max-w-[52ch] text-lead text-muted-foreground">단계마다 고객·직원·TRACE가 하는 일을 순서대로 적었습니다.</p>
          <ol aria-label="대여 순서" className="m-0 mt-12 list-none p-0">
            {stages.map((stage, i) => (
              <StageItem key={stage.id} stage={stage} index={i} />
            ))}
          </ol>
        </section>

        <section id="grade" aria-labelledby="grade-title" className={cn(ANCHOR, "mt-24 md:mt-32")}>
          <Reveal as="h2" id="grade-title" className={H2}>
            상태는 이렇게 판정해요
          </Reveal>
          <p className="m-0 mt-4 max-w-[52ch] text-lead text-muted-foreground">직원이 확정한 흠집만 세어 네 등급으로 나눕니다. A는 문제 없음, B~D는 문제 있음입니다.</p>
          <Reveal className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-[0.9375rem]">
              <caption className="sr-only">등급 기준</caption>
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th scope="col" className="w-20 py-3 pr-4 font-semibold">등급</th>
                  <th scope="col" className="w-32 py-3 pr-4 font-semibold">뜻</th>
                  <th scope="col" className="py-3 font-semibold">기준</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((g) => (
                  <tr key={g.grade} className="border-b">
                    <th scope="row" className={cn("py-4 pr-4 text-title font-bold", g.ok ? "text-success" : "text-destructive")}>
                      {g.grade}
                    </th>
                    <td className="py-4 pr-4 font-medium">{g.label}</td>
                    <td className="py-4 text-muted-foreground">{g.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <Reveal as="ul" className="m-0 mt-8 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-x-10">
            {GRADE_NOTES.map((note) => (
              <li key={note} className="flex gap-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                {note}
              </li>
            ))}
          </Reveal>
        </section>

        <Reveal as="section" id="verify" aria-labelledby="verify-title" className={cn(ANCHOR, "mt-24 rounded-[2rem] bg-sidebar p-7 text-white md:mt-32 md:p-12")}>
          <div className="flex items-start gap-4">
            <Mail aria-hidden="true" className="mt-1.5 size-6 shrink-0 text-brand" />
            <div>
              <h2 id="verify-title" className="m-0 text-headline font-bold">기록은 업체도 고칠 수 없어요</h2>
              <p className="m-0 mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-zinc-400">
                시점마다 검사 기록을 봉인하고, 각 기록은 바로 앞 기록의 지문을 이어 담습니다. 중간 기록 하나만 몰래 바꾸면 뒤 기록과 지문이 맞지 않아 바로 드러납니다.
              </p>
            </div>
          </div>
          <ol aria-label="봉인 기록 확인 순서" className="m-0 mt-10 grid list-none gap-x-8 gap-y-8 p-0 md:grid-cols-3">
            {VERIFY_STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-white/15 pt-5">
                <span aria-hidden="true" className="text-sm font-semibold text-zinc-500 tabular-nums">
                  0{i + 1}
                </span>
                <h3 className="mt-2 mb-2 text-title font-semibold">{s.title}</h3>
                <p className="m-0 text-[0.9375rem] leading-relaxed text-zinc-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <section id="faq" aria-labelledby="faq-title" className={cn(ANCHOR, "mt-24 md:mt-32")}>
          <Reveal as="h2" id="faq-title" className={H2}>
            자주 묻는 질문
          </Reveal>
          <Reveal className="mt-10 border-t">
            {GUIDE_FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1.0625rem] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="mt-1 text-xl leading-none text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="m-0 mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </Reveal>
        </section>

        {(showAccount || signedIn) && (
          <Reveal className="mt-24 flex flex-col items-start gap-5 rounded-[2rem] border p-7 md:mt-32 md:flex-row md:items-center md:justify-between md:p-12">
            <p className="m-0 text-title font-semibold">
              {signedIn ? "연결된 렌탈의 검사 기록을 확인해 보세요." : "가입해 두면 수령 QR을 찍고 로그인만 하면 렌탈이 연결돼요."}
            </p>
            <Link to={signedIn ? myHome : "/signup"} className={cn(buttonVariants({ size: "lg" }), "h-12 shrink-0 rounded-full px-7")}>
              {signedIn ? `${myHomeLabel} 열기` : "회원가입하기"}
            </Link>
          </Reveal>
        )}
      </main>
    </div>
  );
}

/** 단계 하나: 왼쪽에 번호·제목·장소, 오른쪽에 요약·누가 무엇을 하는지·결과 */
function StageItem({ stage, index }: { stage: GuideStage; index: number }) {
  return (
    <Reveal as="li" id={stage.id} className={cn(ANCHOR, "grid gap-6 border-t py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] md:gap-12 md:py-14")}>
      <div>
        <span aria-hidden="true" className="block text-[2.5rem] leading-none font-bold tracking-[-0.04em] text-foreground/20 tabular-nums">
          {index + 1}
        </span>
        <h3 className="mt-4 mb-0 text-title font-bold">
          <span className="sr-only">{index + 1}단계 </span>
          {stage.title}
        </h3>
        <p className="m-0 mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {stage.moment && <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">{stage.moment} 기록</span>}
          {stage.where}
        </p>
      </div>
      <div>
        <p className="m-0 text-[1.0625rem] leading-relaxed font-medium">{stage.summary}</p>
        <ol aria-label={`${stage.title}에서 하는 일`} className="m-0 mt-6 grid list-none gap-4 p-0">
          {stage.actions.map((a) => (
            <li key={a.text} className="grid grid-cols-[4.25rem_1fr] items-start gap-3">
              <span className={cn("rounded-full px-2 py-0.5 text-center text-xs font-semibold", ACTOR_STYLE[a.who])}>{a.who}</span>
              <span className="text-[0.9375rem] leading-relaxed text-muted-foreground">{a.text}</span>
            </li>
          ))}
        </ol>
        <p className="m-0 mt-6 border-l-2 border-brand pl-4 text-[0.9375rem] leading-relaxed">{stage.result}</p>
      </div>
    </Reveal>
  );
}

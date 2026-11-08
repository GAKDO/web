import { Link } from "react-router-dom";
import { Check, Laptop, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "../../../shared/ui/Reveal";
import { FAQ, STEPS } from "../../guide/content";

const VALUES = [
  { icon: ShieldCheck, title: "원래 있던 흠집은 내 책임이 아니에요", text: "내보내기 전 부스 사진이 기준이라, 처음부터 있던 흠집은 따로 구분됩니다." },
  { icon: Sparkles, title: "새로 생긴 흠집만 비교해요", text: "반납 때 처음 사진과 맞대어 새 흠집만 표시하니 다툴 일이 줄어듭니다." },
  { icon: Lock, title: "기록은 업체도 못 고쳐요", text: "시점마다 봉인하고 지문을 메일로 보내 드립니다. 검증 페이지에서 누구나 확인해요." },
  { icon: Laptop, title: "내 노트북을 한눈에", text: "마이페이지에서 빌린 기종의 사양과 출고·수령·반납 검사 결과를 봅니다." },
];

const MYPAGE = ["빌린 노트북의 사양(프로세서·메모리·저장 공간)", "출고·수령·반납 단계별 등급", "사진 위 흠집 위치와 새 흠집 표시", "봉인 기록 검증 링크"];

const SECTION = "mx-auto max-w-6xl px-4 md:px-8";
const H2 = "m-0 text-headline font-bold";
/** 이용 안내로 넘어가는 글자 링크(밝은 바탕) */
const MORE = "mt-10 inline-flex text-[0.9375rem] font-semibold text-foreground underline decoration-foreground/30 underline-offset-[6px] transition-colors hover:decoration-foreground";

/** 판정 기준 두 줄(등급 A / 등급 B~D). 첫 화면 두 배포가 같이 쓴다 */
export function GradeList({ ok, bad }: { ok: string; bad: string }) {
  return (
    <dl className="m-0 mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
      <Reveal className="border-t-2 border-success pt-6">
        <dt className="text-title font-semibold">
          등급 A <span className="text-success">문제 없음</span>
        </dt>
        <dd className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{ok}</dd>
      </Reveal>
      <Reveal index={1} className="border-t-2 border-destructive pt-6">
        <dt className="text-title font-semibold">
          등급 B~D <span className="text-destructive">문제 있음</span>
        </dt>
        <dd className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{bad}</dd>
      </Reveal>
    </dl>
  );
}

/**
 * 고객 계정·리포트가 보이는 배포의 첫 화면 본문(11/6). 렌탈 서비스 첫 화면처럼 장점 → 이용 흐름 → 마이페이지 → 판정 기준 → 자주 묻는 질문 → 가입 순서.
 * 11/8: 같은 모양 카드를 늘어놓는 대신 큰 제목 + 여백 + 얇은 선으로 나누고, 구역마다 스크롤해 들어올 때 한 번 떠오른다(Reveal).
 * 기기 목록(라인업)은 고객용 카탈로그 API가 계약에 생기면 붙인다(가짜 목록을 넣지 않음)
 */
export function CustomerSections({ signedIn, myHome, myHomeLabel }: { signedIn: boolean; myHome: string; myHomeLabel: string }) {
  return (
    <main>
      <section aria-labelledby="values" className={cn(SECTION, "pb-24 md:pb-36")}>
        <Reveal as="h2" id="values" className={H2}>
          빌릴 때도, 돌려줄 때도 마음 편하게
        </Reveal>
        <ul className="m-0 mt-12 grid list-none gap-x-12 gap-y-12 p-0 sm:grid-cols-2 md:mt-16">
          {VALUES.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} index={i % 2}>
              <Icon aria-hidden="true" className="size-6 text-brand" />
              <h3 className="mt-4 mb-2 text-title font-semibold">{title}</h3>
              <p className="m-0 max-w-[38ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="flow" className="bg-sidebar py-24 text-white md:py-36">
        <div className={SECTION}>
          <Reveal as="h2" id="flow" className={H2}>
            대여부터 반납까지 4단계
          </Reveal>
          <ol className="m-0 mt-12 grid list-none gap-x-8 gap-y-10 p-0 md:mt-16 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} index={i} className="border-t border-white/15 pt-6">
                <span className="block text-[2.5rem] leading-none font-bold tracking-[-0.04em] text-white/25 tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-6 mb-2 flex items-center gap-2 text-title font-semibold">
                  <Icon aria-hidden="true" className="size-5 text-brand" />
                  <span className="sr-only">{i + 1}단계 </span>
                  {title}
                </h3>
                <p className="m-0 text-[0.9375rem] leading-relaxed text-zinc-400">{text}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <Link to="/guide" className="mt-12 inline-flex text-[0.9375rem] font-semibold text-white underline decoration-white/30 underline-offset-[6px] transition-colors hover:decoration-white">
              이용 안내 자세히 보기
            </Link>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="mypage" className={cn(SECTION, "grid items-start gap-10 py-24 md:grid-cols-2 md:gap-16 md:py-36")}>
        <Reveal>
          <h2 id="mypage" className={H2}>
            가입하면 이런 걸 볼 수 있어요
          </h2>
          <p className="m-0 mt-5 max-w-[34ch] text-lead text-muted-foreground">렌탈을 계정에 연결하면 검사가 끝날 때마다 결과가 쌓입니다.</p>
        </Reveal>
        <ul className="m-0 grid list-none p-0 md:pt-3">
          {MYPAGE.map((item, i) => (
            <Reveal as="li" key={item} index={i} className="flex items-center gap-4 border-b py-5 first:pt-0">
              <Check aria-hidden="true" className="size-5 shrink-0 text-success" />
              <span className="text-[1.0625rem] font-medium">{item}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="grade" className={cn(SECTION, "pb-24 md:pb-36")}>
        <Reveal as="h2" id="grade" className={H2}>
          판정 기준
        </Reveal>
        <GradeList ok="외관에 수리할 흠집이 없습니다." bad="긁힘·찍힘이 있어 수리가 필요합니다." />
        {/* 첫 화면은 요약만. 등급별 규칙(B·C·D)은 이용 안내에서 자세히 본다 */}
        <Reveal>
          <Link to={{ pathname: "/guide", hash: "grade" }} className={MORE}>
            등급별 자세한 기준 보기
          </Link>
        </Reveal>
      </section>

      <section aria-labelledby="faq" className={cn(SECTION, "grid gap-10 pb-24 md:grid-cols-[1fr_1.6fr] md:gap-16 md:pb-36")}>
        <Reveal as="h2" id="faq" className={H2}>
          자주 묻는 질문
        </Reveal>
        <Reveal className="border-t">
          {FAQ.map(({ q, a }) => (
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
        <Reveal className="md:col-start-2">
          <Link to={{ pathname: "/guide", hash: "faq" }} className={cn(MORE, "mt-0")}>
            질문 더 보기
          </Link>
        </Reveal>
      </section>

      <section aria-labelledby="cta" className={cn(SECTION, "pb-24 md:pb-36")}>
        <Reveal className="flex flex-col items-start gap-6 rounded-[2rem] bg-sidebar px-7 py-12 text-white md:flex-row md:items-end md:justify-between md:px-14 md:py-16">
          <div>
            <h2 id="cta" className="m-0 max-w-[18ch] text-headline font-bold">
              {signedIn ? "내 노트북 기록을 확인해 보세요" : "지금 가입하고 렌탈을 연결하세요"}
            </h2>
            <p className="m-0 mt-4 text-lead text-zinc-400">QR 한 번이면 빌린 노트북이 내 계정에 연결돼요.</p>
          </div>
          <Link to={signedIn ? myHome : "/signup"} className={cn(buttonVariants({ size: "lg" }), "h-12 shrink-0 rounded-full px-7")}>
            {signedIn ? `${myHomeLabel} 열기` : "회원가입하기"}
          </Link>
        </Reveal>
      </section>
    </main>
  );
}

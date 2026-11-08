import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { FAQ, STEPS } from "../content";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "../../../shared/ui/Reveal";
import { SiteHeader } from "../../../shared/ui/SiteHeader";
import { GradeList } from "../../home/components/CustomerSections";
import { isArchived } from "../../../shared/config/features";
import { customerHome } from "../../../shared/config/customerHome";
import { useAuth } from "../../../shared/auth/AuthProvider";

/**
 * 고객 이용 안내(11/6). TRACE는 판매 사이트가 아니라 빌린 노트북 상태를 기록하는 서비스라서,
 * 대여는 창구에서 하고 고객은 QR로 렌탈을 계정에 연결한다는 흐름과 판정·기록 기준을 보여 준다.
 * 라우트에서 report를 보관하면 이 화면도 숨기므로(App.tsx), 여기 안내하는 QR 연결·검증 페이지·내 렌탈은 항상 열린다.
 * 고객용 기기 목록 API가 계약에 없어 기기 목록은 넣지 않는다(목록·가짜 데이터 없음)
 */
export function GuidePage() {
  const showAccount = !isArchived("account");
  const { status, role } = useAuth();
  const signedIn = status === "authenticated";
  const myHome = role === "ADMIN" ? "/admin/devices" : customerHome();
  const myHomeLabel = role === "ADMIN" ? "관리자 화면" : myHome === "/my/rentals" ? "마이페이지" : "내 정보";
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <section className="bg-sidebar text-white">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-20 md:px-8 md:pt-24 md:pb-28">
          <h1 className="stagger m-0 max-w-[14ch] animate-enter text-display font-bold" style={{ "--i": 0 } as CSSProperties}>
            TRACE로 노트북 빌리는 방법
          </h1>
          <p className="stagger mt-6 mb-0 max-w-xl animate-enter text-lead text-zinc-400" style={{ "--i": 1 } as CSSProperties}>
            빌린 노트북의 상태를 내보낼 때와 돌려받을 때 부스 사진으로 남깁니다. 원래 있던 흠집으로 책임을 지는 일이 없도록, 기록은 고객도 함께 봅니다.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-32">
        <Reveal as="h2" className="m-0 text-headline font-bold">대여부터 반납까지</Reveal>
        <ol aria-label="대여 순서" className="m-0 mt-10 grid list-none gap-x-8 gap-y-10 p-0 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} index={i} className="border-t border-foreground/15 pt-6">
              <Icon aria-hidden="true" className="size-6 text-brand" />
              <h3 className="mt-5 mb-2 text-title font-semibold">
                <span className="mr-2 text-muted-foreground tabular-nums">0{i + 1}</span>
                {title}
              </h3>
              <p className="m-0 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal as="h2" className="mt-24 mb-0 text-headline font-bold md:mt-32">상태는 이렇게 판정해요</Reveal>
        <GradeList ok="외관에 수리할 흠집이 없습니다." bad="긁힘·찍힘이 있어 수리가 필요합니다. 리포트에서 사진 위 흠집 위치를 볼 수 있습니다." />

        <Reveal as="section" aria-labelledby="sealed" className="mt-24 flex items-start gap-5 rounded-[2rem] bg-sidebar p-7 text-white md:mt-32 md:p-12">
          <Mail aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand" />
          <div>
            <h2 id="sealed" className="m-0 text-title font-bold">기록은 업체도 고칠 수 없어요</h2>
            <p className="m-0 mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-zinc-400">
              시점마다 검사 기록을 봉인하고 그 지문을 메일로 보내 드립니다. 메일은 업체가 고칠 수 없으니, 검증 페이지의 지문과 같으면 봉인 뒤 바뀌지 않은 기록입니다.
            </p>
          </div>
        </Reveal>

        <Reveal as="h2" className="mt-24 mb-0 text-headline font-bold md:mt-32">자주 묻는 질문</Reveal>
        <Reveal className="mt-10 border-t">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group border-b py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1.0625rem] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="mt-1 text-xl leading-none text-muted-foreground transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="m-0 mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </Reveal>

        {(showAccount || signedIn) && (
          <Reveal className="mt-24 flex flex-col items-start gap-5 rounded-[2rem] border p-7 md:mt-32 md:flex-row md:items-center md:justify-between md:p-12">
            <p className="m-0 text-title font-semibold">
              {signedIn ? "연결된 렌탈의 검사 기록을 확인해 보세요." : "가입해 두면 QR 한 번으로 렌탈이 내 계정에 연결돼요."}
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

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Camera, ScanSearch, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanVisual } from "../../../shared/ui/ScanVisual";
import { Reveal } from "../../../shared/ui/Reveal";
import { SiteHeader } from "../../../shared/ui/SiteHeader";
import { CustomerSections, GradeList } from "./CustomerSections";
import { isArchived } from "../../../shared/config/features";
import { customerHome } from "../../../shared/config/customerHome";
import { useAuth } from "../../../shared/auth/AuthProvider";

const STEPS = [
  { icon: Camera, title: "부스 촬영", text: "기기를 부스에 올리면 윗면·바닥을 카메라 2대, 조명 3개로 12장 찍습니다." },
  { icon: ScanSearch, title: "흠집 판정", text: "부스가 사진에서 긁힘·찍힘을 찾고, 서버가 등급을 매깁니다." },
  { icon: ShieldCheck, title: "결과 확인", text: "관리자 화면에서 사진 위 흠집 위치와 문제 있음·없음을 봅니다." },
];

const MOMENTS = ["내보낼 때 한 번.", "받을 때 한 번.", "돌려줄 때 한 번."];

/**
 * 첫 화면(gakdo.site). 고객 계정(AU2)을 보이는 배포에서는 회원가입·로그인이 기본 입구이고 관리자 로그인은 맨 아래 작은 링크로만 둔다.
 * 고객 계정을 숨긴 배포에서는 관리자 로그인이 입구다.
 * 어두운 첫 칸에 검사 막대 그림, 세 시점 문장, 아래에 세 단계와 판정 기준. 아래 구역은 스크롤해 들어올 때 떠오르며 나타난다(Reveal)
 */
export function HomePage() {
  const showAccount = !isArchived("account");
  // 내 렌탈(report)을 숨긴 배포에서는 가입 뒤 볼 수 있는 곳이 내 계정뿐이라 안내를 바꾼다
  const showReport = !isArchived("report");
  // 로그인한 채 로고를 눌러 첫 화면에 오면 위쪽 버튼을 "내 화면으로 돌아가기"로 바꾼다
  const { status, role } = useAuth();
  const signedIn = status === "authenticated";
  const myHome = role === "ADMIN" ? "/admin/devices" : customerHome();
  const myHomeLabel = role === "ADMIN" ? "관리자 화면" : myHome === "/my/rentals" ? "마이페이지" : "내 정보";
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <section className="relative isolate overflow-hidden bg-sidebar text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 md:grid-cols-[1.5fr_1fr] md:px-8 md:pt-24 md:pb-32">
          <div>
            <h1 className="stagger m-0 animate-enter text-display font-bold" style={{ "--i": 0 } as CSSProperties}>
              {showAccount ? (
                <>
                  빌린 노트북 상태,
                  <br />
                  사진으로 남겨 드려요
                </>
              ) : (
                <>
                  노트북 상태를
                  <br />
                  투명하게, 정확하게
                </>
              )}
            </h1>
            <p className="stagger mt-6 mb-0 max-w-[30rem] animate-enter text-lead text-zinc-400" style={{ "--i": 1 } as CSSProperties}>
              {showAccount
                ? `받을 때와 돌려줄 때 부스에서 찍은 사진으로 흠집을 기록합니다. ${showReport ? "가입하면 마이페이지에서 사진과 흠집 기록을 바로 볼 수 있어요." : "미리 가입해 두면 렌탈받을 때 바로 이어서 쓸 수 있어요."}`
                : "빌려주기 전과 돌려받은 뒤, 부스에서 찍은 사진으로 흠집을 찾아 기록합니다. 누가 봐도 같은 결과를 사진과 함께 남깁니다."}
            </p>
            <div className="stagger mt-10 flex animate-enter flex-wrap gap-3" style={{ "--i": 2 } as CSSProperties}>
              {signedIn ? (
                <Link to={myHome} className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-6")}>
                  {myHomeLabel} 열기
                </Link>
              ) : showAccount ? (
                <>
                  <Link to="/signup" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-6")}>
                    회원가입하고 시작하기
                  </Link>
                  {/* 이용 안내는 report가 보일 때만 열린다. 숨긴 배포에서는 전처럼 로그인 버튼 */}
                  <Link to={showReport ? "/guide" : "/login"} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white")}>
                    {showReport ? "빌리는 방법 보기" : "로그인"}
                  </Link>
                </>
              ) : (
                <Link to="/admin/login" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-6")}>
                  관리자 화면 열기
                </Link>
              )}
              <Link to="/devices" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white")}>
                보유 노트북 비교하기
              </Link>
            </div>
          </div>
          {/* 스크롤로 첫 화면을 벗어날 때 그림이 살짝 작아지며 물러난다(index.css .hero-recede) */}
          <div className="hero-recede">
            <ScanVisual className="mx-auto max-w-[28.75rem]" />
          </div>
        </div>
      </section>

      {/* 애플 소개 화면처럼 큰 문장이 스크롤에 맞춰 한 줄씩 밝아진다. 세 시점(출고·수령·반납)이 이 서비스의 뼈대라 여기에 힘을 준다 */}
      <section aria-label="세 번의 기록" className="mx-auto max-w-6xl px-4 py-24 md:px-8 md:py-40">
        <p className="m-0 text-headline font-bold">
          {MOMENTS.map((line) => (
            <span key={line} className="scrub-line block">
              {line}
            </span>
          ))}
          <span className="scrub-line mt-4 block text-muted-foreground md:mt-6">세 번의 사진이 봉인된 하나의 기록이 됩니다.</span>
        </p>
      </section>

      {showAccount && showReport ? (
        <CustomerSections signedIn={signedIn} myHome={myHome} myHomeLabel={myHomeLabel} />
      ) : (
        <main className="mx-auto max-w-6xl px-4 pb-20 md:px-8 md:pb-32">
          <Reveal as="h2" className="m-0 text-headline font-bold">
            이렇게 검사합니다
          </Reveal>
          <ol className="m-0 mt-10 grid list-none gap-x-10 gap-y-10 p-0 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} index={i} className="border-t border-foreground/15 pt-6">
                <Icon aria-hidden="true" className="size-6 text-brand" />
                <h3 className="mt-5 mb-2 text-title font-semibold">
                  <span className="sr-only">{i + 1}단계 </span>
                  {title}
                </h3>
                <p className="m-0 max-w-[34ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal as="h2" className="mt-24 mb-0 text-headline font-bold md:mt-32">
            판정 기준
          </Reveal>
          <GradeList ok="수리할 흠집이 없습니다." bad="긁힘·찍힘이 있어 수리가 필요합니다." />
        </main>
      )}
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t px-4 py-6 text-xs text-muted-foreground md:px-8">
        <span>TRACE Rental Management System</span>
        {/* 관리자 입구는 고객이 먼저 보이도록 맨 아래 작은 링크로만 둔다 */}
        {showAccount && (
          <nav aria-label="바로 가기" className="flex flex-wrap items-center gap-4">
            {showReport && (
              <Link to="/guide" className="underline-offset-4 hover:text-foreground hover:underline">
                이용 안내
              </Link>
            )}
            <Link to="/admin/login" className="underline-offset-4 hover:text-foreground hover:underline">
              관리자 로그인
            </Link>
          </nav>
        )}
      </footer>
    </div>
  );
}

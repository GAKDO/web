import { useState, type CSSProperties } from "react";
import { Navigate } from "react-router-dom";
import { Camera, ScanSearch, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";
import { ScanVisual } from "../../../shared/ui/ScanVisual";
import { TraceLogo } from "../../../shared/ui/TraceLogo";
import { customerHome } from "../../../shared/config/customerHome";
import { isArchived } from "../../../shared/config/features";

// 왼쪽 면에 적는 세 단계(MVP 흐름: 부스 촬영 → 흠집 판정 → 결과 확인). 장식이라 읽는 내용만 짧게
const STEPS = [
  { icon: Camera, text: "부스에서 윗면·바닥 12장 촬영" },
  { icon: ScanSearch, text: "흠집을 찾아 등급 판정" },
  { icon: ShieldCheck, text: "관리자 화면에서 결과 확인" },
];

/**
 * 관리자 로그인: 화면 전체를 어두운 바탕 하나로 잇고, 768px 이상은 왼쪽 소개 + 오른쪽 흰 입력 카드, 375px은 위아래.
 * 디자인 도구(ui-ux-pro-max) 추천대로 장식은 격자 무늬와 빨간 빛 하나만 두고, 2560px에서도 양쪽 내용 폭을 묶어 비지 않게 한다
 */
export function LoginPage() {
  const { status, role, notice, login } = useAuth();
  // 고객 계정(AU2)을 보이는 배포에서는 한 화면으로 로그인한다: 관리자는 관리자 화면, 고객은 내 계정으로
  const unified = !isArchived("account");
  // 이 화면에서 방금 로그인했을 때만 고객을 내 계정으로 보낸다. 이미 고객으로 로그인한 채 들어오면 관리자 계정으로 바꿔 로그인할 수 있게 둔다
  const [submitted, setSubmitted] = useState(false);

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;
  if (unified && submitted && status === "authenticated" && role === "CUSTOMER") return <Navigate to={customerHome()} replace />;

  return (
    <div className="relative isolate grid min-h-svh grid-rows-[auto_1fr] overflow-hidden bg-sidebar md:grid-cols-[1.1fr_1fr] md:grid-rows-none">
      <section aria-label="TRACE 소개" className="flex flex-col justify-center px-5 py-8 text-white md:px-12 md:py-12">
        {/* 장식: 격자 무늬 + 빨간 빛(읽는 내용 없음) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]"
        />
        <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 size-[26.25rem] rounded-full bg-brand/35 blur-[120px]" />
        <div className="mx-auto w-full max-w-[30rem]">
          <TraceLogo className="h-12 animate-enter md:h-14" />
          <p className="stagger mt-6 mb-3 animate-enter text-[1.625rem] leading-tight font-bold tracking-tight md:mt-10 md:text-[2.5rem]" style={{ "--i": 1 } as CSSProperties}>
            노트북 상태를
            <br />
            투명하고 정확하게
          </p>
          <p className="m-0 text-zinc-400">부스 사진으로 렌탈 노트북의 흠집을 찾고 기록합니다.</p>
          {/* 검사 막대가 노트북을 훑는 그림(장식). 폰에서는 입력칸이 먼저 보이게 뺀다.
              768px 이상에서는 화면 높이에 맞춰 그림 높이를 줄여(로고·글자·단계 약 38rem을 뺀 나머지, 최대 16:9) 스크롤 없이 한 화면에 들어오게 하고,
              높이가 낮은 창(760px 이하)에서는 그림을 뺀다 */}
          <ScanVisual className="mt-8 hidden md:block md:aspect-auto md:h-[clamp(0rem,calc(100svh-38rem),16.875rem)] [@media(max-height:760px)]:md:hidden" />
          <ol className="m-0 mt-8 hidden list-none gap-3 p-0 md:grid">
            {STEPS.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="stagger flex animate-enter items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
                style={{ "--i": i + 2 } as CSSProperties}
              >
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-white/10 text-white">
                  <Icon className="size-[1.125rem]" />
                </span>
                <span className="text-sm text-zinc-300">
                  <span className="mr-2 font-semibold text-white tabular-nums">0{i + 1}</span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <main className="flex flex-col items-center justify-start gap-4 px-4 pt-2 pb-8 md:justify-center md:py-8">
        {/* 장식: 카드 뒤 옅은 빨간 빛. 왼쪽과 같은 어두운 바탕을 이어 써서 화면이 둘로 갈라져 보이지 않게 한다(읽는 내용 없음) */}
        <div aria-hidden="true" className="absolute right-[12%] bottom-[-10%] -z-10 hidden size-[30rem] rounded-full bg-brand/20 blur-[140px] md:block" />
        <Card className="surface-dark w-full max-w-[26rem] animate-enter [animation-delay:120ms] gap-5 border-white/10 py-7 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl">
          <CardHeader className="px-7">
            <h1 className="m-0 text-2xl font-bold tracking-tight">{unified ? "로그인" : "관리자 로그인"}</h1>
            <CardDescription>
              {unified ? "관리자 계정이면 관리자 화면으로, 고객 계정이면 내 계정으로 이동합니다." : "관리자 계정 이메일과 비밀번호를 넣어 주세요."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 px-7">
            {status === "authenticated" && role !== "ADMIN" && (
              <p role="status" className="m-0 text-sm text-warning">
                {LOGIN_NOTICE.notAdmin}
              </p>
            )}
            {notice && (
              <p role="status" className="m-0 text-sm text-warning">
                {LOGIN_NOTICE[notice]}
              </p>
            )}
            <LoginForm
              onLogin={async (email, password) => {
                await login(email, password, unified ? "ANY" : "ADMIN");
                setSubmitted(true);
              }}
            />
          </CardContent>
        </Card>
        <p className="m-0 text-xs text-zinc-500">TRACE Rental Management System</p>
      </main>
    </div>
  );
}

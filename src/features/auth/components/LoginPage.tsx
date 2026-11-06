import type { CSSProperties } from "react";
import { Navigate } from "react-router-dom";
import { Camera, ScanSearch, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";
import { ScanVisual } from "../../../shared/ui/ScanVisual";

// 왼쪽 면에 적는 세 단계(MVP 흐름: 부스 촬영 → 흠집 판정 → 결과 확인). 장식이라 읽는 내용만 짧게
const STEPS = [
  { icon: Camera, text: "부스에서 윗면·바닥 12장 촬영" },
  { icon: ScanSearch, text: "흠집을 찾아 등급 판정" },
  { icon: ShieldCheck, text: "관리자 화면에서 결과 확인" },
];

/**
 * 관리자 로그인: 768px 이상은 왼쪽 어두운 브랜드 면 + 오른쪽 입력, 375px은 위아래.
 * 디자인 도구(ui-ux-pro-max) 추천대로 장식은 격자 무늬와 빨간 빛 하나만 두고, 2560px에서도 양쪽 내용 폭을 묶어 비지 않게 한다
 */
export function LoginPage() {
  const { status, role, notice, login } = useAuth();

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr] bg-background md:grid-cols-[1.1fr_1fr] md:grid-rows-none">
      <section aria-label="TRACE 소개" className="relative isolate flex flex-col justify-center overflow-hidden bg-sidebar px-5 py-8 text-white md:px-12 md:py-12">
        {/* 장식: 격자 무늬 + 빨간 빛(읽는 내용 없음) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
        />
        <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 size-[26.25rem] rounded-full bg-brand/35 blur-[120px]" />
        <div className="mx-auto w-full max-w-[30rem]">
          <span className="inline-flex animate-enter items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-black shadow-[0_0_32px_-4px_var(--brand)]">
              T
            </span>
            <span className="text-2xl font-bold tracking-[0.14em]">TRACE</span>
          </span>
          <p className="stagger mt-6 mb-3 animate-enter text-[1.625rem] leading-tight font-bold tracking-tight md:mt-10 md:text-[2.5rem]" style={{ "--i": 1 } as CSSProperties}>
            노트북 상태를
            <br />
            <span className="bg-gradient-to-r from-brand to-[#ff5a5f] bg-clip-text text-transparent">투명하게</span>, 정확하게
          </p>
          <p className="m-0 text-zinc-400">렌탈 기기 검사 · 관리 시스템</p>
          {/* 검사 막대가 노트북을 훑는 그림(장식). 폰에서는 입력칸이 먼저 보이게 뺀다.
              768px 이상에서는 화면 높이에 맞춰 그림 높이를 줄여(글자·단계 약 37rem을 뺀 나머지, 최대 16:9) 스크롤 없이 한 화면에 들어오게 하고,
              높이가 아주 낮은 창(680px 이하)에서는 그림을 뺀다 */}
          <ScanVisual className="mt-8 hidden md:block md:aspect-auto md:h-[clamp(6rem,calc(100svh-37rem),16.875rem)] [@media(max-height:680px)]:md:hidden" />
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
      <main className="relative isolate flex flex-col items-center justify-start gap-4 overflow-hidden px-4 py-6 md:justify-center md:py-8">
        {/* 장식: 넓은 화면에서 입력 쪽이 텅 비어 보이지 않게 옅은 점 무늬와 빨간 빛(읽는 내용 없음) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden bg-[radial-gradient(rgb(16_24_40/0.07)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] md:block"
        />
        <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 hidden size-[32rem] -translate-1/2 rounded-full bg-brand/[0.06] blur-[120px] md:block" />
        <Card className="w-full max-w-[26rem] animate-enter [animation-delay:120ms] gap-5 py-7 shadow-[0_8px_40px_-12px_rgb(16_24_40/0.18)]">
          <CardHeader className="px-7">
            <h1 className="m-0 text-2xl font-bold tracking-tight">관리자 로그인</h1>
            <CardDescription>관리자 계정 이메일과 비밀번호를 넣어 주세요.</CardDescription>
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
            <LoginForm onLogin={(email, password) => login(email, password)} />
          </CardContent>
        </Card>
        <p className="m-0 text-xs text-muted-foreground">TRACE Rental Management System</p>
      </main>
    </div>
  );
}

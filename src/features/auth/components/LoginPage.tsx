import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { LoginForm } from "../../../shared/auth/LoginForm";
import { LOGIN_NOTICE } from "../../../shared/auth/loginNotice";

/** 관리자 로그인(11/4 목업): 768px 이상은 왼쪽 브랜드 면 + 오른쪽 입력, 375px은 위아래. 2560px에서도 양쪽이 비지 않게 폭을 묶는다 */
export function LoginPage() {
  const { status, role, notice, login } = useAuth();

  if (status === "authenticated" && role === "ADMIN") return <Navigate to="/admin/devices" replace />;

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr] bg-background md:grid-cols-[1.2fr_1fr] md:grid-rows-none">
      <section
        aria-label="TRACE 소개"
        className="flex flex-col gap-6 bg-gradient-to-br from-zinc-50 to-zinc-200/70 px-4 pt-5 pb-6 md:items-center md:justify-center md:gap-[10vh] md:px-12 md:py-10"
      >
        <div className="w-full md:max-w-[440px] min-[1600px]:max-w-[520px]">
          <p className="m-0 text-[32px] font-extrabold tracking-wide text-brand md:text-[42px]">TRACE</p>
          <p className="my-1 text-[22px] leading-snug font-bold md:text-[32px]">
            노트북 상태를
            <br />
            투명하게, 정확하게
          </p>
          <p className="m-0 text-muted-foreground">렌탈 기기 검사 · 관리 시스템</p>
        </div>
        {/* 사진 파일 대신 선으로 그린 노트북(넓은 화면의 빈 공간을 채움, 읽는 내용은 없음) */}
        <svg
          viewBox="0 0 320 200"
          aria-hidden="true"
          focusable="false"
          className="hidden w-full fill-none stroke-zinc-300 stroke-[3] [stroke-linecap:round] [stroke-linejoin:round] md:block md:max-w-[440px] min-[1600px]:max-w-[520px]"
        >
          <rect x="60" y="20" width="200" height="130" rx="8" />
          <rect x="74" y="34" width="172" height="102" rx="3" className="fill-white stroke-zinc-200" />
          <path d="M30 160h260l-14 20H44z" />
          <path d="M138 160h44" className="stroke-[4]" />
          <path d="M96 84l24 24 48-48" className="stroke-brand stroke-[6]" />
        </svg>
      </section>
      <main className="flex flex-col items-center justify-center gap-4 px-4 py-6">
        <Card className="w-full max-w-[380px] shadow-md min-[1600px]:max-w-[420px]">
          <CardHeader>
            <h1 className="m-0 text-xl font-bold tracking-tight">관리자 로그인</h1>
            <CardDescription>관리자 계정 이메일과 비밀번호를 넣어 주세요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
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

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SocialProvider } from "../../../shared/api/types";
import { AuthDivider } from "../../../shared/ui/AuthShell";
import { SOCIAL_LABEL, socialStartUrl, useSocialProviders } from "../api/socialLogin";

// 제공자마다 각 회사 브랜드 안내에 가까운 바탕색. Google은 흰 바탕, GitHub는 어두운 회색
const TONE: Partial<Record<SocialProvider, string>> = {
  GOOGLE: "border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f2f2f2] hover:text-[#1f1f1f]",
  GITHUB: "border-white/10 bg-[#24292f] text-white hover:bg-[#32383f] hover:text-white",
  KAKAO: "border-transparent bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 hover:text-[#191919]",
  NAVER: "border-transparent bg-[#03C75A] text-white hover:bg-[#03C75A]/90 hover:text-white",
};

// 로고는 외부 이미지 없이 인라인 SVG로 둔다(CSP·오프라인 시연에서도 깨지지 않게). 글자가 이름을 말하므로 aria-hidden
const ICON: Partial<Record<SocialProvider, ReactNode>> = {
  GOOGLE: (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  ),
  GITHUB: (
    <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
};

/**
 * 로그인 화면 아래쪽의 "또는" 구분선과 "Google로 계속하기" 같은 버튼.
 * 이메일 로그인 폼 뒤에 둔다. 서버에 켜진 제공자가 없으면 아무것도 그리지 않는다
 */
export function SocialLoginButtons({ next }: { next: string }) {
  const { data: providers = [] } = useSocialProviders();
  if (providers.length === 0) return null;
  return (
    <section aria-label="소셜 로그인">
      <AuthDivider>또는</AuthDivider>
      <div className="grid gap-2.5">
        {providers.map((p) => (
          <a
            key={p}
            href={socialStartUrl(p, next)}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "relative w-full gap-2.5 font-semibold", TONE[p])}
          >
            {ICON[p]}
            {SOCIAL_LABEL[p]}로 계속하기
          </a>
        ))}
      </div>
      <p className="m-0 mt-3 text-xs leading-relaxed text-zinc-400">
        처음 로그인하면 그 계정의 이메일로 TRACE 회원가입이 되고, 이메일·이름 수집·이용에 동의한 것으로 봅니다. 같은 이메일로 가입한 계정이
        있으면 그 계정으로 로그인됩니다.{" "}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-zinc-200">
          개인정보처리방침
        </Link>
      </p>
    </section>
  );
}

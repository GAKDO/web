import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SocialProvider } from "../../../shared/api/types";
import { AuthDivider } from "../../../shared/ui/AuthShell";
import { SOCIAL_LABEL, socialStartUrl, useSocialProviders } from "../api/socialLogin";

// 제공자마다 알아보기 쉬운 바탕색(각 제공자 안내의 기본 색에 가깝게). 나머지는 기본 테두리 버튼
const TONE: Partial<Record<SocialProvider, string>> = {
  KAKAO: "border-transparent bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 hover:text-[#191919]",
  NAVER: "border-transparent bg-[#03C75A] text-white hover:bg-[#03C75A]/90 hover:text-white",
};

/** 로그인 화면의 "Google로 계속하기" 같은 버튼. 서버에 켜진 제공자가 없으면 아무것도 그리지 않는다 */
export function SocialLoginButtons({ next }: { next: string }) {
  const { data: providers = [] } = useSocialProviders();
  if (providers.length === 0) return null;
  return (
    <section aria-label="소셜 로그인" className="mb-2">
      <div className="grid gap-2">
        {providers.map((p) => (
          <a
            key={p}
            href={socialStartUrl(p, next)}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full", TONE[p])}
          >
            {SOCIAL_LABEL[p]}로 계속하기
          </a>
        ))}
      </div>
      <p className="m-0 mt-2 text-xs text-zinc-400">
        처음 로그인하면 그 계정의 이메일로 TRACE 회원가입이 되고, 이메일·이름 수집·이용에 동의한 것으로 봅니다. 같은 이메일로 가입한 계정이
        있으면 그 계정으로 로그인됩니다.
      </p>
      <AuthDivider>또는 이메일로 로그인</AuthDivider>
    </section>
  );
}

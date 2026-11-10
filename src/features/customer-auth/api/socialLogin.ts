import { useQuery } from "@tanstack/react-query";
import { BASE, publicApi, unwrap } from "../../../shared/api/client";
import type { SocialLoginError, SocialProvider } from "../../../shared/api/types";

/** 서버에 키가 설정된 소셜 로그인 제공자(없거나 실패하면 빈 목록: 버튼을 숨기고 이메일 로그인만 보인다) */
export function useSocialProviders() {
  return useQuery({
    queryKey: ["auth", "oauth", "providers"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<SocialProvider[]> =>
      (await unwrap(publicApi.GET("/api/v1/auth/oauth/providers"))).providers,
  });
}

/**
 * 소셜 로그인 시작 주소. fetch가 아니라 브라우저가 이동해야 한다(서버가 제공자 화면으로 302).
 * 끝나면 서버가 리프레시 쿠키를 심고 /login?next=… 로 돌려보내고, AuthProvider의 첫 refresh가 세션을 연다
 */
export function socialStartUrl(provider: SocialProvider, next: string): string {
  const query = new URLSearchParams({ next }).toString();
  return `${BASE}/api/v1/auth/oauth/${provider.toLowerCase()}/start?${query}`;
}

export const SOCIAL_LABEL: Record<SocialProvider, string> = {
  GOOGLE: "Google",
  GITHUB: "GitHub",
  KAKAO: "카카오",
  NAVER: "네이버",
};

/** 콜백이 /login?socialError=<값> 으로 알려 준 실패 사유(codes.yaml auth.social_login_error) */
export const SOCIAL_ERROR_MESSAGE: Record<SocialLoginError, string> = {
  UNAVAILABLE: "지금은 이 방법으로 로그인할 수 없습니다. 이메일로 로그인해 주세요.",
  CANCELLED: "소셜 로그인을 취소했습니다.",
  STATE_INVALID: "로그인 시간이 지났거나 다른 창에서 시작한 로그인입니다. 다시 시도해 주세요.",
  EMAIL_REQUIRED: "이메일을 받지 못해 로그인하지 못했습니다. 제공자 화면에서 이메일 제공에 동의하고, 인증된 이메일인지 확인해 주세요.",
  PROVIDER_ERROR: "로그인 서비스와 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
};

export function socialErrorMessage(raw: string | null): string | null {
  if (!raw) return null;
  return raw in SOCIAL_ERROR_MESSAGE ? SOCIAL_ERROR_MESSAGE[raw as SocialLoginError] : SOCIAL_ERROR_MESSAGE.PROVIDER_ERROR;
}

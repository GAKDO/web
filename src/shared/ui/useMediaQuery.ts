import { useSyncExternalStore } from "react";

/** 폰(767px 이하)인지. 폰은 아래 탭 메뉴·옆 패널, 768px 이상은 왼쪽 메뉴·한 줄 필터 */
export const MOBILE_QUERY = "(max-width: 767px)";

/**
 * 화면 너비 조건이 맞는지. 둘 중 하나만 그려야 화면 읽기가 같은 메뉴를 두 번 읽지 않는다.
 * matchMedia가 없는 곳(테스트 jsdom)은 넓은 화면(false)으로 본다
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

/** 로그인 뒤 돌아갈 경로. 같은 출처의 "/"로 시작하는 경로만 따르고, 나머지(외부 주소·"//")는 첫 화면으로 */
export function safeNext(next: string | null, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

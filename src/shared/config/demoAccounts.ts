/**
 * 시연용 고객 계정 이메일(A가 auth-server에 인증된 상태로 미리 만든다).
 * 빌드할 때 VITE_DEMO_CUSTOMER_EMAILS(쉼표로 구분)로 받고, 비었으면 빈 목록(버튼을 숨김).
 * 비밀번호는 웹 번들에 넣지 않는다. 시연자가 직접 입력한다.
 */
export function demoCustomerEmails(raw: string | undefined = import.meta.env.VITE_DEMO_CUSTOMER_EMAILS): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+$/.test(s)))];
}

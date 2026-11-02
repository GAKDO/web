// 가입 → 인증 → 로그인 화면 사이에 이메일·비밀번호를 넘기는 모듈 변수.
// 주소(쿼리)·라우터 state·저장소에 넣지 않는다(새로 고치면 사라짐). 비밀번호는 자동 로그인에 한 번 쓰고 지운다.
let email: string | null = null;
let password: string | null = null;

export const pendingSignup = {
  set(nextEmail: string, nextPassword: string | null): void {
    email = nextEmail;
    password = nextPassword;
  },
  email: (): string | null => email,
  /** 비밀번호를 꺼내면서 지운다 */
  takePassword(): string | null {
    const value = password;
    password = null;
    return value;
  },
  clear(): void {
    email = null;
    password = null;
  },
};

export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

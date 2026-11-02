import { nanoid } from "nanoid";
import type { TokenRole } from "../api/types";

// MSW 목 서버의 메모리 데이터. ID는 계약대로 NanoID 21자(헌법 1.1.0). 테스트마다 resetDb()로 처음 상태로 돌린다.
// 계정·비밀번호는 계약 예시 값이고 실제 비밀이 아니다.
export const MOCK_ADMIN = { email: "admin@example.com", password: "example-pass-1234" } as const;
export const MOCK_CUSTOMER = { email: "renter@example.com", password: "example-pass-1234" } as const;

interface Account {
  accountId: string;
  email: string;
  password: string;
  role: TokenRole;
}

interface MockState {
  accounts: Account[];
  /** 살아 있는 액세스 토큰 → 계정 */
  accessTokens: Map<string, Account>;
  /** 리프레시 쿠키 대신: 브라우저 쿠키는 테스트(Node)에서 유지되지 않아 계정 하나를 기억한다 */
  refreshAccount: Account | null;
}

function initialState(): MockState {
  return {
    accounts: [
      { accountId: nanoid(), ...MOCK_ADMIN, role: "ADMIN" },
      { accountId: nanoid(), ...MOCK_CUSTOMER, role: "CUSTOMER" },
    ],
    accessTokens: new Map(),
    refreshAccount: null,
  };
}

export let db: MockState = initialState();

export function resetDb(): void {
  db = initialState();
}

export function issueAccessToken(account: Account): string {
  const token = `mock.${nanoid()}`;
  db.accessTokens.set(token, account);
  return token;
}

/** 테스트용: 지금 액세스 토큰을 모두 만료시킨다 */
export function expireAccessTokens(): void {
  db.accessTokens.clear();
}

export function accountFromRequest(request: Request): Account | null {
  const header = request.headers.get("Authorization") ?? "";
  return db.accessTokens.get(header.replace(/^Bearer /, "")) ?? null;
}

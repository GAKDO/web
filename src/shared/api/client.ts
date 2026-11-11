import createClient from "openapi-fetch";
import { captureTokenStore } from "../auth/captureTokenStore";
import { tokenStore } from "../auth/tokenStore";
import { ApiError, networkError, toApiError } from "./problem";
import type { ApiPaths, CaptureApiPaths, TokenResponse } from "./types";

// 화면의 모든 API 호출은 이 파일을 거친다. 토큰 붙이기, 401 때 한 번 다시 받기, 오류 변환을 여기서만 한다(FR-004·034).
// 비우면 같은 출처. Request에는 절대 주소가 필요해 location.origin을 쓴다
export const BASE = import.meta.env.VITE_API_BASE || window.location.origin;
const REFRESH_PATH = "/api/v1/auth/refresh";
/** 이 요청의 401은 세션 만료가 아니다(틀린 비밀번호·리프레시 실패). 다시 받기·세션 종료를 하지 않는다 */
const NO_RETRY_PATHS = [REFRESH_PATH, "/api/v1/auth/login"];

let onSessionExpired: () => void = () => {};
let refreshing: Promise<RefreshOutcome> | null = null;

/** 다시 받기까지 실패해 세션이 끝났을 때 부를 함수(AuthProvider가 정함) */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

const REFRESH_LOCK = "trace-auth-refresh";

/** 리프레시 쿠키를 읽거나 바꾸는 요청을 브라우저 잠금(Web Locks)으로 탭 사이에서도 한 번에 하나씩 보낸다.
 * 서버는 리프레시 토큰을 쓸 때마다 새것으로 바꾸고 쓴 것은 지우므로(토큰 회전), 두 탭이 같은 쿠키로 동시에 보내면 늦은 쪽이 401을 받는다.
 * 잠금을 지원하지 않는 환경이면 그냥 보낸다 */
async function withCookieLock<T>(send: () => Promise<T>): Promise<T> {
  if (!("locks" in navigator) || !navigator.locks) return send();
  return await navigator.locks.request(REFRESH_LOCK, send);
}

function postRefresh(): Promise<Response> {
  return withCookieLock(() => fetch(`${BASE}${REFRESH_PATH}`, { method: "POST", credentials: "include" }));
}

/** 이 탭에서 진행 중인 리프레시가 있으면 끝날 때까지 기다린다. 늦게 온 리프레시 응답의 쿠키가 로그아웃 뒤에 다시 붙지 않게 한다 */
export async function waitForRefresh(): Promise<void> {
  await refreshing;
}

/** 로그인처럼 새 리프레시 쿠키를 받는 요청. 진행 중인 리프레시(이 탭·다른 탭)가 끝난 뒤에 보내, 이전 계정의 늦은 응답이 새 쿠키를 덮어쓰지 않게 한다.
 * 이 안에서 리프레시를 부르면 잠금을 기다리다 멈추므로, 401에 다시 받기를 하지 않는 요청(NO_RETRY_PATHS)에만 쓴다 */
export async function withRefreshExclusive<T>(send: () => Promise<T>): Promise<T> {
  await waitForRefresh();
  return withCookieLock(send);
}

/** ok = 새 토큰, rejected = 서버가 리프레시를 거절(세션 끝), transient = 네트워크 오류·5xx(세션은 그대로) */
export type RefreshOutcome = "ok" | "rejected" | "transient";

/** 리프레시 쿠키로 액세스 토큰을 다시 받고 결과를 나눠 알려 준다. 한 탭 안에서는 동시에 불려도 요청은 한 번만 간다 */
export function refreshSessionOutcome(): Promise<RefreshOutcome> {
  refreshing ??= (async (): Promise<RefreshOutcome> => {
    const startedAt = tokenStore.epoch();
    // 기다리는 동안 로그인·로그아웃이 있었다면 그 결과를 지키고, 이 응답은 버린다
    const changed = (): RefreshOutcome => (tokenStore.get() !== null ? "ok" : "rejected");
    try {
      const response = await postRefresh();
      if (tokenStore.epoch() !== startedAt) return changed();
      if (!response.ok) return response.status >= 500 ? "transient" : "rejected";
      const token = (await response.json()) as TokenResponse;
      if (tokenStore.epoch() !== startedAt) return changed();
      tokenStore.set(token);
      return "ok";
    } catch {
      // 기다리는 동안 새로 로그인했다면 이전 요청의 실패를 새 세션에 옮기지 않는다
      if (tokenStore.epoch() !== startedAt) return changed();
      return "transient";
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** 리프레시 쿠키로 액세스 토큰을 다시 받는다. 새 토큰을 받았을 때만 true */
export async function refreshSession(): Promise<boolean> {
  return (await refreshSessionOutcome()) === "ok";
}

function withToken(request: Request): Request {
  const session = tokenStore.get();
  const next = new Request(request, { credentials: "include" });
  if (session) next.headers.set("Authorization", `Bearer ${session.accessToken}`);
  return next;
}

/** 세션을 되살릴 수 없을 때: 토큰을 지우고 로그인 화면으로 보내는 처리를 부른다 */
export function expireSession(): void {
  tokenStore.clear();
  onSessionExpired();
}

/** 토큰은 살아 있고 입력한 비밀번호만 틀린 401(탈퇴 확인 등). 세션 만료로 다루지 않는다 */
async function isCredentialRejection(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return body.code === "INVALID_CREDENTIALS";
  } catch {
    return false;
  }
}

async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const response = await fetch(withToken(request));
  if (response.status !== 401 || NO_RETRY_PATHS.some((p) => new URL(request.url).pathname.endsWith(p)) || !tokenStore.get()) return response;
  if (await isCredentialRejection(response)) return response;
  const outcome = await refreshSessionOutcome();
  if (outcome !== "ok") {
    // 서버가 리프레시를 거절했을 때만 세션을 끝낸다. 네트워크 오류·5xx는 세션(과 촬영 권한)을 그대로 두고 이 요청만 실패시킨다
    if (outcome === "rejected") expireSession();
    return response;
  }
  const second = await fetch(withToken(retry));
  if (second.status === 401 && !(await isCredentialRejection(second))) expireSession();
  return second;
}

export const api = createClient<ApiPaths>({ baseUrl: BASE, fetch: authFetch });

/** 공개 API(검증 페이지)용. 로그인해 있어도 토큰·쿠키를 붙이지 않는다(WE4 FR-002).
 * fetch는 부를 때 찾는다(만들 때 잡아 두면 테스트의 MSW가 끼어들지 못함) */
export const publicApi = createClient<ApiPaths>({
  baseUrl: BASE,
  fetch: (request: Request) => fetch(new Request(request, { credentials: "omit" })),
});

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** openapi-fetch 결과에서 data를 꺼내고, 실패면 ApiError를 던진다 */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch {
    throw networkError();
  }
  if (result.error !== undefined || !result.response.ok) throw toApiError(result.response.status, result.error);
  return result.data as T;
}

export { ApiError };

// capture-server는 촬영 JWT로만 부른다. 리프레시가 없으므로 401이면 그대로 돌려주고 화면이 새 QR을 안내한다(WE2 R1).
async function captureFetch(request: Request): Promise<Response> {
  const grant = captureTokenStore.get();
  const next = new Request(request);
  if (grant) next.headers.set("Authorization", `Bearer ${grant.accessToken}`);
  return fetch(next);
}

export const captureApi = createClient<CaptureApiPaths>({ baseUrl: BASE, fetch: captureFetch });

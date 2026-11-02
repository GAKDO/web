import createClient from "openapi-fetch";
import { captureTokenStore } from "../auth/captureTokenStore";
import { tokenStore } from "../auth/tokenStore";
import { ApiError, networkError, toApiError } from "./problem";
import type { ApiPaths, CaptureApiPaths, TokenResponse } from "./types";

// 화면의 모든 API 호출은 이 파일을 거친다. 토큰 붙이기, 401 때 한 번 다시 받기, 오류 변환을 여기서만 한다(FR-004·034).
// 비우면 같은 출처. Request에는 절대 주소가 필요해 location.origin을 쓴다
const BASE = import.meta.env.VITE_API_BASE || window.location.origin;
const REFRESH_PATH = "/api/v1/auth/refresh";

let onSessionExpired: () => void = () => {};
let refreshing: Promise<boolean> | null = null;

/** 다시 받기까지 실패해 세션이 끝났을 때 부를 함수(AuthProvider가 정함) */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

/** 리프레시 쿠키로 액세스 토큰을 다시 받는다. 동시에 불려도 요청은 한 번만 간다 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${BASE}${REFRESH_PATH}`, { method: "POST", credentials: "include" });
      if (!response.ok) return false;
      tokenStore.set((await response.json()) as TokenResponse);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function withToken(request: Request): Request {
  const session = tokenStore.get();
  const next = new Request(request, { credentials: "include" });
  if (session) next.headers.set("Authorization", `Bearer ${session.accessToken}`);
  return next;
}

async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const response = await fetch(withToken(request));
  if (response.status !== 401 || request.url.endsWith(REFRESH_PATH) || !tokenStore.get()) return response;
  if (!(await refreshSession())) {
    tokenStore.clear();
    onSessionExpired();
    return response;
  }
  const second = await fetch(withToken(retry));
  if (second.status === 401) {
    tokenStore.clear();
    onSessionExpired();
  }
  return second;
}

export const api = createClient<ApiPaths>({ baseUrl: BASE, fetch: authFetch });

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

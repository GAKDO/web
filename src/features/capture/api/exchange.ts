import { api, unwrap } from "../../../shared/api/client";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";

// QR 토큰은 1회용이라 같은 토큰을 두 번 보내면 두 번째가 410이 된다. StrictMode·재렌더에도 요청은 한 번만 보낸다.
// 키에 세션 세대를 넣어, 로그인·로그아웃 뒤의 호출은 이전 세션의 요청을 함께 쓰지 않는다.
const inflight = new Map<string, Promise<CaptureGrant>>();

export function exchangeOnce(token: string): Promise<CaptureGrant> {
  const started = captureTokenStore.generation();
  const key = `${started}:${token}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = unwrap(api.POST("/api/v1/auth/capture-links/exchange", { body: { token } })).then((r) => {
      // 기다리는 동안 로그아웃·다른 계정 로그인이 있었으면 옛 세션의 허가를 저장하지 않는다
      if (captureTokenStore.generation() !== started) throw new Error("session changed");
      return captureTokenStore.set(r);
    });
    // 끝나면(성공·실패 모두) 지운다
    const done = () => inflight.delete(key);
    pending.then(done, done);
    inflight.set(key, pending);
  }
  return pending;
}

import { api, unwrap } from "../../../shared/api/client";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";

// QR 토큰은 1회용이라 같은 토큰을 두 번 보내면 두 번째가 410이 된다. StrictMode·재렌더에도 요청은 한 번만 보낸다.
const inflight = new Map<string, Promise<CaptureGrant>>();

export function exchangeOnce(token: string): Promise<CaptureGrant> {
  let pending = inflight.get(token);
  if (!pending) {
    pending = unwrap(api.POST("/api/v1/auth/capture-links/exchange", { body: { token } })).then((r) => captureTokenStore.set(r));
    // 네트워크 오류면 같은 토큰으로 다시 시도할 수 있게 지운다
    pending.catch(() => inflight.delete(token));
    inflight.set(token, pending);
  }
  return pending;
}

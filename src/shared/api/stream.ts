import { fetchEventSource } from "@microsoft/fetch-event-source";
import { tokenStore } from "../auth/tokenStore";
import { BASE, expireSession, refreshSessionOutcome } from "./client";
import type { DoneEvent, ProgressEvent } from "./types";

// 검사 진행률 SSE(FR-RPT-04). 계약대로 Authorization 헤더가 필요해 fetch 기반으로 붙는다.
// 끊기거나 5xx·408·429면 스스로 다시 붙고, 401이면 토큰을 한 번 다시 받은 뒤 붙는다.
// 리프레시가 거절됐거나 연달아 401이면 세션 만료로 처리하고(네트워크 오류면 세션을 두고 다시 붙음), 그 밖의 4xx(403·404 등)는 다시 붙지 않는다.

export interface ProgressHandlers {
  onProgress(event: ProgressEvent): void;
  onDone(event: DoneEvent): void;
  /** true = 다시 붙는 중, false = 붙음 */
  onReconnecting(reconnecting: boolean): void;
  /** 붙을 때마다(첫 연결 포함). 타임라인을 읽은 뒤·끊긴 동안 놓친 봉인을 다시 읽는 데 쓴다 */
  onConnected(): void;
  /** 다시 붙지 않고 멈췄을 때(403·404, 세션 만료 등) */
  onFatal(error: StreamFatal): void;
}

class Retry extends Error {}
/** 다시 붙어도 소용없는 오류. 재시도를 멈춘다 */
export class StreamFatal extends Error {}

const RETRY_MS = 2_000;

export function openProgressStream(rentalId: string, handlers: ProgressHandlers, signal: AbortSignal): Promise<void> {
  const url = `${BASE}/api/v1/reports/rentals/${encodeURIComponent(rentalId)}/stream`;
  let refreshed = false;
  return fetchEventSource(url, {
    signal,
    openWhenHidden: true,
    // 다시 붙을 때마다 지금 토큰을 붙인다(다시 받은 토큰 포함)
    fetch: (input, init) => {
      const token = tokenStore.get()?.accessToken;
      return fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    },
    async onopen(response) {
      if (response.status === 401) {
        // 화면을 떠난 스트림은 전역 세션을 건드리지 않는다
        if (signal.aborted) return;
        const outcome = refreshed ? "rejected" : await refreshSessionOutcome();
        if (signal.aborted) return;
        // 네트워크 오류·5xx로 다시 받지 못했으면 세션을 지키고 잠시 뒤 다시 붙는다
        if (outcome === "transient") throw new Retry("refresh unavailable");
        if (outcome === "rejected") {
          expireSession();
          throw new StreamFatal("401");
        }
        refreshed = true;
        throw new Retry("401");
      }
      const { status } = response;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) throw new StreamFatal(`HTTP ${status}`);
      if (!response.ok) throw new Retry(`HTTP ${status}`);
      refreshed = false;
      handlers.onReconnecting(false);
      handlers.onConnected();
    },
    onmessage(message) {
      if (!message.data) return;
      if (message.event === "progress") handlers.onProgress(JSON.parse(message.data) as ProgressEvent);
      else if (message.event === "done") handlers.onDone(JSON.parse(message.data) as DoneEvent);
    },
    onclose() {
      throw new Retry("closed");
    },
    onerror(error) {
      if (signal.aborted) return null;
      if (error instanceof StreamFatal) {
        handlers.onReconnecting(false);
        handlers.onFatal(error);
        // 던지면 fetchEventSource가 재시도를 멈추고 Promise를 reject한다
        throw error;
      }
      handlers.onReconnecting(true);
      return RETRY_MS;
    },
  });
}

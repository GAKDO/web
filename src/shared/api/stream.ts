import { fetchEventSource } from "@microsoft/fetch-event-source";
import { tokenStore } from "../auth/tokenStore";
import { BASE, refreshSession } from "./client";
import type { DoneEvent, ProgressEvent } from "./types";

// 검사 진행률 SSE(FR-RPT-04). 계약대로 Authorization 헤더가 필요해 fetch 기반으로 붙는다.
// 끊기면 스스로 다시 붙고, 401이면 토큰을 한 번 다시 받은 뒤 붙는다.

export interface ProgressHandlers {
  onProgress(event: ProgressEvent): void;
  onDone(event: DoneEvent): void;
  /** true = 다시 붙는 중, false = 붙음 */
  onReconnecting(reconnecting: boolean): void;
}

class Retry extends Error {}

const RETRY_MS = 2_000;

export function openProgressStream(rentalId: string, handlers: ProgressHandlers, signal: AbortSignal): Promise<void> {
  const url = `${BASE}/api/v1/reports/rentals/${encodeURIComponent(rentalId)}/stream`;
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
        await refreshSession();
        throw new Retry("401");
      }
      if (!response.ok) throw new Retry(`HTTP ${response.status}`);
      handlers.onReconnecting(false);
    },
    onmessage(message) {
      if (!message.data) return;
      if (message.event === "progress") handlers.onProgress(JSON.parse(message.data) as ProgressEvent);
      else if (message.event === "done") handlers.onDone(JSON.parse(message.data) as DoneEvent);
    },
    onclose() {
      throw new Retry("closed");
    },
    onerror() {
      if (signal.aborted) return null;
      handlers.onReconnecting(true);
      return RETRY_MS;
    },
  });
}

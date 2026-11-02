import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { openProgressStream } from "../../../shared/api/stream";
import type { ProgressEvent } from "../../../shared/api/types";
import { REPORT } from "./report";

export interface ProgressState {
  /** 시점 ID → 마지막 진행률 */
  byCheckpoint: Record<string, ProgressEvent>;
  reconnecting: boolean;
}

/** 봉인 전 시점이 있을 때만 진행률을 받는다(FR-020·021). 봉인 알림이 오면 리포트를 다시 읽는다 */
export function useProgress(rentalId: string, enabled: boolean): ProgressState {
  const client = useQueryClient();
  const [state, setState] = useState<ProgressState>({ byCheckpoint: {}, reconnecting: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void openProgressStream(
      rentalId,
      {
        onProgress: (event) => setState((s) => ({ ...s, byCheckpoint: { ...s.byCheckpoint, [event.checkpointId]: event } })),
        onDone: () => void client.invalidateQueries({ queryKey: REPORT }),
        onReconnecting: (reconnecting) => setState((s) => (s.reconnecting === reconnecting ? s : { ...s, reconnecting })),
      },
      controller.signal,
    ).catch(() => undefined);
    return () => controller.abort();
  }, [rentalId, enabled, client]);
  return state;
}

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { openProgressStream } from "../../../shared/api/stream";
import { INSPECTIONS } from "../../inspections/api/inspections";

/** 연달아 이만큼 다시 붙지 못하면 SSE를 접고 주기적 다시 읽기(useRental 폴링)만 쓴다 */
export const LIVE_MAX_RETRIES = 5;

export type LiveState = "connecting" | "live" | "polling";

/**
 * 렌탈 상세의 실시간 갱신(RP2, contracts streamRentalProgress).
 * report-server가 보내는 검사 진행(촬영 올림·판정·등급·봉인)이 오면 렌탈 상세와 검사 결과를 바로 다시 읽는다.
 * report-server가 없거나 끊겨도 화면은 useRental의 주기적 다시 읽기로 계속 맞는다(SSE는 빠르게 하는 덧붙임).
 */
export function useRentalLive(rentalId: string, enabled: boolean): LiveState {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");
  useEffect(() => {
    if (!enabled || !rentalId) {
      setState("polling");
      return;
    }
    setState("connecting");
    const controller = new AbortController();
    let misses = 0;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["rentals"] });
      void client.invalidateQueries({ queryKey: INSPECTIONS });
    };
    void openProgressStream(
      rentalId,
      {
        onProgress: refresh,
        onDone: refresh,
        onConnected: () => {
          misses = 0;
          setState("live");
          refresh();
        },
        onReconnecting: (reconnecting) => {
          if (!reconnecting) return;
          misses += 1;
          if (misses >= LIVE_MAX_RETRIES) {
            // onReconnecting은 fetch-event-source의 onerror 안에서 불리고, 라이브러리는 그 뒤에 재시도 타이머를 만든다.
            // 지금 abort하면 그 타이머가 남아 다시 붙으므로, 타이머가 생긴 다음 차례에 abort해 타이머까지 지운다
            setTimeout(() => controller.abort(), 0);
            setState("polling");
          } else setState("connecting");
        },
        onFatal: () => setState("polling"),
      },
      controller.signal,
    ).catch(() => setState("polling"));
    return () => controller.abort();
  }, [rentalId, enabled, client]);
  return state;
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { faceGuides, PHONE_FACES, type FaceGuide } from "../faces";

// 윤곽 가이드에 쓸 실제 기종 치수. 리포트 타임라인의 modelCode → GET /device-models/{modelCode}(고객 로그인 토큰).
// 촬영 토큰으로는 부를 수 없고(captureToken: false), 못 읽으면 기본 치수 윤곽으로 그대로 찍는다.
const KEY = ["capture", "model"] as const;
/** 치수를 이만큼 기다려도 안 오면 기본 치수 윤곽으로 찍게 한다 */
export const MODEL_WAIT_MS = 5_000;

export interface FaceGuidesState {
  faces: readonly FaceGuide[];
  /** 치수를 받는 중(촬영 시작을 잠시 막는다). 실패·시간 초과면 false가 되고 기본 윤곽을 쓴다 */
  loading: boolean;
}

export function useFaceGuides(rentalId: string, waitMs: number = MODEL_WAIT_MS): FaceGuidesState {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), waitMs);
    return () => clearTimeout(id);
  }, [waitMs]);
  const timeline = useQuery({
    queryKey: [...KEY, "timeline", rentalId],
    queryFn: () => unwrap(api.GET("/api/v1/reports/rentals/{rentalId}", { params: { path: { rentalId } } })),
    retry: false,
    staleTime: Infinity,
  });
  const modelCode = timeline.data?.modelCode;
  const model = useQuery({
    queryKey: [...KEY, modelCode],
    queryFn: () => unwrap(api.GET("/api/v1/device-models/{modelCode}", { params: { path: { modelCode: modelCode ?? "" } } })),
    enabled: !!modelCode,
    retry: false,
    staleTime: Infinity,
  });
  const dims = model.data?.dimensions;
  const faces = useMemo(() => (dims ? faceGuides(dims) : PHONE_FACES), [dims]);
  const loading = !timedOut && (timeline.isPending || (!!modelCode && model.isPending));
  // 촬영을 시작할 수 있게 된 순간의 윤곽으로 고정한다. 시간 초과 뒤 늦게 온 치수로 찍는 도중 윤곽이 바뀌지 않게 한다
  const [locked, setLocked] = useState<readonly FaceGuide[] | null>(null);
  useEffect(() => {
    if (!loading && !locked) setLocked(faces);
  }, [loading, locked, faces]);
  return { faces: locked ?? faces, loading };
}

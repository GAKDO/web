import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { faceGuides, PHONE_FACES, type FaceGuide } from "../faces";

// 윤곽 가이드에 쓸 실제 기종 치수. 리포트 타임라인의 modelCode → GET /device-models/{modelCode}(고객 로그인 토큰).
// 촬영 토큰으로는 부를 수 없고(captureToken: false), 못 읽으면 기본 치수 윤곽으로 그대로 찍는다.
const KEY = ["capture", "model"] as const;

export function useFaceGuides(rentalId: string): readonly FaceGuide[] {
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
  return useMemo(() => (dims ? faceGuides(dims) : PHONE_FACES), [dims]);
}

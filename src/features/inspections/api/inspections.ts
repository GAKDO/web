import { useQuery } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "../../../shared/api/client";
import type { Inspection } from "../../../shared/api/types";

// 관리자 검사 결과 화면(spec 006)의 서버 상태. 검사 결과는 capture-server, 렌탈 목록·상세는 rentals 기능의 훅을 그대로 쓴다
export const INSPECTIONS = ["inspections"] as const;

/** 한 시점의 검사 결과. 아직 없으면(404) 오류가 아니라 null(판정 대기). 404는 다시 시도하지 않는다 */
export function useCheckpointInspection(checkpointId: string | undefined) {
  return useQuery<Inspection | null>({
    queryKey: [...INSPECTIONS, checkpointId],
    queryFn: async () => {
      try {
        return await unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/inspection", { params: { path: { checkpointId: checkpointId ?? "" } } }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!checkpointId,
    retry: false,
  });
}

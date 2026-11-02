import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";

// WE3 리포트 화면의 서버 상태. 모두 GET이고, 사진 보기 주소는 Query 캐시(메모리)에만 둔다(FR-023)
export const REPORT = ["report"] as const;

export function useMyRentals() {
  return useQuery({
    queryKey: [...REPORT, "rentals"],
    queryFn: () => unwrap(api.GET("/api/v1/rentals", { params: { query: { limit: 50 } } })),
  });
}

export function useDeviceModel(modelCode: string | undefined) {
  return useQuery({
    queryKey: [...REPORT, "model", modelCode],
    queryFn: () => unwrap(api.GET("/api/v1/device-models/{modelCode}", { params: { path: { modelCode: modelCode ?? "" } } })),
    enabled: !!modelCode,
    staleTime: Infinity,
  });
}

export function useTimeline(rentalId: string) {
  return useQuery({
    queryKey: [...REPORT, "timeline", rentalId],
    queryFn: () => unwrap(api.GET("/api/v1/reports/rentals/{rentalId}", { params: { path: { rentalId } } })),
    retry: false,
  });
}

export function useInspection(checkpointId: string | undefined) {
  return useQuery({
    queryKey: [...REPORT, "inspection", checkpointId],
    queryFn: () =>
      unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/inspection", { params: { path: { checkpointId: checkpointId ?? "" } } })),
    enabled: !!checkpointId,
  });
}

/** 사진 보기 주소는 10분 뒤 만료된다. 만료 1분 전에 새로 받는다(FR-009) */
export function mediaRefreshMs(expiresAt: string, now = Date.now()): number {
  return Math.max(5_000, new Date(expiresAt).getTime() - now - 60_000);
}

export function useCheckpointMedia(checkpointId: string | undefined) {
  return useQuery({
    queryKey: [...REPORT, "media", checkpointId],
    queryFn: () =>
      unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/media", { params: { path: { checkpointId: checkpointId ?? "" } } })),
    enabled: !!checkpointId,
    refetchInterval: (query) => (query.state.data ? mediaRefreshMs(query.state.data.expiresAt) : false),
  });
}

export function useDiagnostics(checkpointId: string | undefined) {
  return useQuery({
    queryKey: [...REPORT, "diagnostics", checkpointId],
    queryFn: () => unwrap(api.GET("/api/v1/diagnostics/checkpoints/{checkpointId}", { params: { path: { checkpointId: checkpointId ?? "" } } })),
    enabled: !!checkpointId,
    retry: false,
  });
}

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "../../../shared/api/client";

// WE3 리포트 화면의 서버 상태. 모두 GET이고, 사진 보기 주소는 Query 캐시(메모리)에만 둔다(FR-023)
export const REPORT = ["report"] as const;

export const MY_RENTALS_PAGE_SIZE = 20;

/** 내 렌탈 목록. "더 보기"는 커서로 다음 쪽을 이어 붙인다 */
export function useMyRentals() {
  return useInfiniteQuery({
    queryKey: [...REPORT, "rentals"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/rentals", { params: { query: { limit: MY_RENTALS_PAGE_SIZE, cursor: pageParam } } })),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
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

/** 반납 정산서(11/10). 반납 시점이 등급을 받은 뒤에만 부른다(그 전에는 서버도 PENDING) */
export function useSettlement(checkpointId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...REPORT, "settlement", checkpointId],
    queryFn: () =>
      unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/settlement", { params: { path: { checkpointId: checkpointId ?? "" } } })),
    enabled: !!checkpointId && enabled,
    retry: false,
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

/**
 * 이 시점의 진단. 아직 올라오지 않았으면(404) 오류가 아니라 null로 받는다.
 * 404를 오류로 두면 데이터가 한 번도 없는 쿼리라 다시 읽을 때마다 TanStack Query가 status를 pending으로 되돌리고,
 * 렌탈 상세의 페어링 코드 칸이 5초마다 사라졌다 다시 그려져 발급한 코드가 지워졌다(11/8 출고 페어링 코드 사라짐).
 * pollMs: 진단이 아직 없을 때 이 간격으로 다시 읽는다. 렌탈 상세에서 에이전트가 올리는 순간 보이게 한다
 */
export function useDiagnostics(checkpointId: string | undefined, pollMs?: number) {
  return useQuery({
    queryKey: [...REPORT, "diagnostics", checkpointId],
    queryFn: () =>
      unwrap(api.GET("/api/v1/diagnostics/checkpoints/{checkpointId}", { params: { path: { checkpointId: checkpointId ?? "" } } })).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
    enabled: !!checkpointId,
    retry: false,
    refetchInterval: (query) => (pollMs && !query.state.data ? pollMs : false),
  });
}

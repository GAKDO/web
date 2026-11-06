import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";
import type { CheckpointType, Rental, RentalCreateRequest, RentalStatus } from "../../../shared/api/types";
import { nextAction } from "../nextAction";

const RENTALS = ["rentals"] as const;
const rentalKey = (rentalId: string) => [...RENTALS, "detail", rentalId] as const;

/** 목록을 열어 둔 동안 다시 읽는 간격(검사 결과 목록). 부스가 시점을 시작하면 카드의 지금 시점이 바뀐다 */
export const RENTALS_LIVE_MS = 5000;

export function useRentals(status?: RentalStatus, options: { live?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: [...RENTALS, "list", status ?? "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/rentals", { params: { query: { status, cursor: pageParam } } })),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: options.live ? RENTALS_LIVE_MS : false,
  });
}

/** 봉인 전 시점이 있을 때 다시 읽는 간격 */
export const RENTAL_ACTIVE_MS = 3000;
/** 모든 시점이 봉인됐지만 렌탈이 진행 중일 때(부스가 다음 시점을 시작할 수 있음) 다시 읽는 간격 */
export const RENTAL_IDLE_MS = 10000;

/** 다시 읽는 간격. 종료된 렌탈은 멈추고, 봉인 전 시점이 있으면 3초, 다 봉인됐어도 진행 중이면 10초(부스 빠른 검사가 다음 시점을 연다) */
export function rentalPollMs(rental: Rental | undefined): number | false {
  if (!rental || nextAction(rental).kind === "closed") return false;
  return rental.checkpoints.some((c) => c.status !== "SEALED") ? RENTAL_ACTIVE_MS : RENTAL_IDLE_MS;
}

/** 렌탈 상세. 진행 중인 동안 주기적으로 다시 읽어 시점·버튼을 맞춘다(SSE가 없거나 끊겨도 동작) */
export function useRental(rentalId: string) {
  return useQuery({
    queryKey: rentalKey(rentalId),
    queryFn: () => unwrap(api.GET("/api/v1/rentals/{rentalId}", { params: { path: { rentalId } } })),
    refetchInterval: (query) => rentalPollMs(query.state.data),
  });
}

export function useCreateRental() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RentalCreateRequest) => unwrap(api.POST("/api/v1/rentals", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: RENTALS }),
  });
}

/** 시점 시작·종료는 성공이든 409든 상세를 다시 읽는다(FR-022·023) */
export function useStartCheckpoint(rentalId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (type: CheckpointType) =>
      unwrap(api.POST("/api/v1/rentals/{rentalId}/checkpoints", { params: { path: { rentalId } }, body: { type } })),
    onSettled: () => client.invalidateQueries({ queryKey: RENTALS }),
  });
}

export function useCloseRental(rentalId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/rentals/{rentalId}/close", { params: { path: { rentalId } } })),
    onSettled: () => client.invalidateQueries({ queryKey: RENTALS }),
  });
}

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, unwrap } from "../../../shared/api/client";
import type { CheckpointType, RentalCreateRequest, RentalStatus } from "../../../shared/api/types";
import { nextAction } from "../nextAction";

const RENTALS = ["rentals"] as const;
const rentalKey = (rentalId: string) => [...RENTALS, "detail", rentalId] as const;

export function useRentals(status?: RentalStatus, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: [...RENTALS, "list", status ?? "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/rentals", { params: { query: { status, cursor: pageParam } } })),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/**
 * 렌탈 기기의 시리얼. 렌탈 상세(Rental)에는 시리얼이 없어 목록·등록 화면이 넘긴 값을 쓰고,
 * 없으면(주소로 바로 들어옴) 렌탈 목록을 찾을 때까지 다음 쪽으로 넘기며 찾는다(최대 SERIAL_PAGE_LIMIT쪽). 못 찾으면 undefined.
 */
export const SERIAL_PAGE_LIMIT = 20;
export function useRentalSerial(rentalId: string, hint?: string): string | undefined {
  const list = useRentals(undefined, !hint);
  const found = list.data?.pages.flatMap((p) => p.items).find((r) => r.rentalId === rentalId)?.serial;
  const pages = list.data?.pages.length ?? 0;
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = list;
  useEffect(() => {
    if (!hint && !found && hasNextPage && !isFetchingNextPage && !isError && pages < SERIAL_PAGE_LIMIT) void fetchNextPage();
  }, [hint, found, hasNextPage, isFetchingNextPage, isError, pages, fetchNextPage]);
  return hint ?? found;
}

/** 렌탈 상세. 봉인 전 시점이 있는 동안 3초마다 다시 읽어 버튼을 맞춘다 */
export function useRental(rentalId: string) {
  return useQuery({
    queryKey: rentalKey(rentalId),
    queryFn: () => unwrap(api.GET("/api/v1/rentals/{rentalId}", { params: { path: { rentalId } } })),
    refetchInterval: (query) => {
      const rental = query.state.data;
      const waiting = rental?.checkpoints.some((c) => c.status !== "SEALED");
      return rental && nextAction(rental).kind !== "closed" && waiting ? 3000 : false;
    },
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

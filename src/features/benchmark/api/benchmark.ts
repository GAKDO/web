import { useQueries, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";
import type { RentalSummary } from "../../../shared/api/types";
import { inspectionQuery } from "../../inspections/api/inspections";
import type { CheckpointResult } from "../model/stats";

/** 한 번에 모으는 렌탈 목록 쪽 수 상한. 전체 건수·집계 API가 계약에 없어(contracts#23) 화면이 목록을 모아 센다 */
export const MAX_RENTAL_PAGES = 10;

/** 렌탈 목록을 끝까지(최대 MAX_RENTAL_PAGES쪽) 모은다. truncated면 더 있었지만 상한에서 멈춘 것 */
export function useAllRentals() {
  return useQuery({
    queryKey: ["benchmark", "rentals"],
    queryFn: async () => {
      const items: RentalSummary[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_RENTAL_PAGES; page += 1) {
        const res = await unwrap(api.GET("/api/v1/rentals", { params: { query: { cursor } } }));
        items.push(...res.items);
        cursor = res.nextCursor ?? undefined;
        if (!cursor) return { items, truncated: false };
      }
      return { items, truncated: true };
    },
  });
}

/**
 * 성능 그래프 화면의 데이터: 렌탈마다 상세(시점 최대 3개)를 읽고, 촬영이 끝난 시점마다 검사 결과를 읽는다.
 * 검사 결과는 검사 결과 화면과 같은 키라 이미 읽은 것은 다시 읽지 않는다
 */
export function useBenchmarkData() {
  const rentals = useAllRentals();
  const ids = rentals.data?.items.map((r) => r.rentalId) ?? [];
  const details = useQueries({
    queries: ids.map((rentalId) => ({
      queryKey: ["benchmark", "rental", rentalId],
      queryFn: () => unwrap(api.GET("/api/v1/rentals/{rentalId}", { params: { path: { rentalId } } })),
    })),
  });
  const checkpoints = details.flatMap((d) => d.data?.checkpoints ?? []).filter((c) => c.status !== "OPEN");
  const inspections = useQueries({ queries: checkpoints.map((c) => inspectionQuery(c.checkpointId)) });
  const results: CheckpointResult[] = checkpoints.map((checkpoint, i) => ({ checkpoint, inspection: inspections[i]?.data ?? null }));
  const failed = details.filter((d) => d.isError).length + inspections.filter((q) => q.isError).length;
  const loading = rentals.isPending || details.some((d) => d.isPending) || inspections.some((q) => q.isPending);
  return {
    rentals,
    results,
    loading,
    failed,
    rentalCount: ids.length,
    truncated: rentals.data?.truncated ?? false,
    refetch: () => {
      void rentals.refetch();
      details.forEach((d) => void d.refetch());
      inspections.forEach((q) => void q.refetch());
    },
  };
}

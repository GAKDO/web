import { useQueries, useQuery } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "../../../shared/api/client";
import type { CheckpointDiagnostics, RentalSummary } from "../../../shared/api/types";
import { REPORT } from "../../report/api/report";
import { maskSerial } from "../../../shared/ui/maskSerial";
import type { DiagnosedCheckpoint } from "../model/diagnostics";

/** 기기 하나의 렌탈을 모으는 쪽 수 상한(쪽마다 20건) */
export const MAX_DEVICE_RENTAL_PAGES = 5;

const TYPE_ORDER = { OUT: 0, RCV: 1, RET: 2 } as const;

/** 기기의 렌탈 전부(최근 생성 순, 최대 100건). GET /rentals?deviceId (contracts #28) */
export function useAllDeviceRentals(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["rentals", "list", "device", deviceId, "all"],
    enabled: !!deviceId,
    queryFn: async () => {
      const items: RentalSummary[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_DEVICE_RENTAL_PAGES; page += 1) {
        const res = await unwrap(api.GET("/api/v1/rentals", { params: { query: { deviceId, cursor } } }));
        items.push(...res.items);
        cursor = res.nextCursor ?? undefined;
        if (!cursor) break;
      }
      return items;
    },
  });
}

/**
 * 기기의 모든 진단: 렌탈마다 상세(시점 최대 3개)를 읽고, 촬영 대기가 아닌 시점마다 진단 요약을 읽는다.
 * 진단이 없는 시점(404)은 뺀다.
 * 결과는 오래된 렌탈부터, 렌탈 안에서는 출고·수령·반납 순이다
 */
export function useDeviceDiagnostics(deviceId: string | undefined) {
  const rentals = useAllDeviceRentals(deviceId);
  const list = rentals.data ?? [];
  const details = useQueries({
    queries: list.map((r) => ({
      queryKey: ["rentals", "detail", r.rentalId],
      queryFn: () => unwrap(api.GET("/api/v1/rentals/{rentalId}", { params: { path: { rentalId: r.rentalId } } })),
    })),
  });
  const checkpoints = details.flatMap((d, i) =>
    (d.data?.checkpoints ?? []).filter((c) => c.status !== "OPEN").map((c) => ({ rental: list[i], checkpoint: c })),
  );
  const diags = useQueries({
    queries: checkpoints.map(({ checkpoint }) => ({
      // 없으면 null로 담으므로 리포트·렌탈 상세 진단 칸(404를 오류로 받음)과 키를 나눈다. 같은 키면 한 화면에 함께 있을 때 null을 진단으로 읽는다
      queryKey: [...REPORT, "diagnostics", checkpoint.checkpointId, "orNull"],
      queryFn: async (): Promise<CheckpointDiagnostics | null> => {
        try {
          return await unwrap(api.GET("/api/v1/diagnostics/checkpoints/{checkpointId}", { params: { path: { checkpointId: checkpoint.checkpointId } } }));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }
      },
      retry: false,
    })),
  });
  const diagnosed: DiagnosedCheckpoint[] = [];
  checkpoints.forEach(({ rental, checkpoint }, i) => {
    const d = diags[i]?.data;
    if (d)
      diagnosed.push({
        rentalId: rental.rentalId,
        renterRef: rental.renterRef ?? maskSerial(rental.serial),
        createdAt: rental.createdAt,
        type: checkpoint.type,
        checkpointId: checkpoint.checkpointId,
        diagnostics: d,
      });
  });
  diagnosed.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  return {
    rentals,
    diagnosed,
    loading: rentals.isPending || details.some((d) => d.isPending) || diags.some((q) => q.isPending),
    failed: details.filter((d) => d.isError).length + diags.filter((q) => q.isError).length,
    refetch: () => {
      void rentals.refetch();
      details.forEach((d) => void d.refetch());
      diags.forEach((q) => void q.refetch());
    },
  };
}

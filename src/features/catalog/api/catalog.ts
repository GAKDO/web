import { useQueries, useQuery } from "@tanstack/react-query";
import { ApiError, publicApi as api, unwrap } from "../../../shared/api/client";
import type { CatalogDiagnostics, CatalogInspection, CatalogInspectionSummary } from "../../../shared/api/types";
import { checkpointIdsOf, chunks, mergeCatalog, type CatalogRow } from "../model/catalog";

// 공개 보유 기기 목록·상세(11/8, contracts #33). 로그인 없이 부른다(publicApi: 로그인해 있어도 토큰을 붙이지 않아 만료 토큰 401에 걸리지 않는다).
export const CATALOG = ["catalog"] as const;

/** 계약: checkpointIds는 쉼표로 이은 한 값(form, explode=false), 최대 100개 */
const COMMA = { array: { style: "form", explode: false } } as const;
const MAX_IDS = 100;

/**
 * 목록 한 번: rental 기기 목록 → 시점 ID로 capture 흠집 요약·diagnostics 진단을 함께 묻고 한 줄씩 합친다.
 * 흠집·진단 중 하나가 실패해도 기기 목록은 보이고, 그 칸만 비운다(partial로 알리고, 흠집 요약 실패는 inspectionsFailed로 따로 알린다)
 */
export function useCatalog() {
  return useQuery({
    queryKey: [...CATALOG, "list"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ rows: CatalogRow[]; partial: boolean; inspectionsFailed: boolean }> => {
      const { items: devices } = await unwrap(api.GET("/api/v1/catalog/devices"));
      const groups = chunks(checkpointIdsOf(devices), MAX_IDS);
      const [inspections, diagnostics] = await Promise.allSettled([
        Promise.all(
          groups.map((ids) => unwrap(api.GET("/api/v1/captures/catalog", { params: { query: { checkpointIds: ids } }, querySerializer: COMMA }))),
        ).then((pages): CatalogInspectionSummary[] => pages.flatMap((p) => p.items)),
        Promise.all(
          groups.map((ids) => unwrap(api.GET("/api/v1/diagnostics/catalog", { params: { query: { checkpointIds: ids } }, querySerializer: COMMA }))),
        ).then((pages): CatalogDiagnostics[] => pages.flatMap((p) => p.items)),
      ]);
      const ins = inspections.status === "fulfilled" ? inspections.value : [];
      const diag = diagnostics.status === "fulfilled" ? diagnostics.value : [];
      const inspectionsFailed = inspections.status === "rejected";
      return { rows: mergeCatalog(devices, ins, diag), partial: inspectionsFailed || diagnostics.status === "rejected", inspectionsFailed };
    },
  });
}

/** 상세의 사진·확정 흠집. 사진 주소는 만료(기본 10분)가 있어 8분마다 새로 받는다 */
export function useCatalogInspection(checkpointId: string | undefined) {
  return useQuery({
    queryKey: [...CATALOG, "inspection", checkpointId],
    enabled: !!checkpointId,
    staleTime: 8 * 60_000,
    refetchInterval: 8 * 60_000,
    queryFn: () => unwrap(api.GET("/api/v1/captures/catalog/checkpoints/{checkpointId}", { params: { path: { checkpointId: checkpointId ?? "" } } })),
  });
}

/**
 * 흠집별 처음 발견 검사를 찾으려고 이전 검사들의 공개 상세를 함께 받는다(11/11 민서 요청).
 * 부스 검사가 아니거나 등급 전이면 404라 null로 둔다. 흠집 위치만 쓰므로 사진 주소 만료와 상관없이 오래 둔다
 */
export function useCatalogHistory(checkpointIds: string[]) {
  return useQueries({
    queries: checkpointIds.map((id) => ({
      queryKey: [...CATALOG, "history", id],
      staleTime: 30 * 60_000,
      retry: (count: number, error: unknown) => !(error instanceof ApiError && error.status === 404) && count < 2,
      queryFn: async (): Promise<CatalogInspection | null> => {
        try {
          return await unwrap(api.GET("/api/v1/captures/catalog/checkpoints/{checkpointId}", { params: { path: { checkpointId: id } } }));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }
      },
    })),
  });
}

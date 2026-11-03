import { useQuery } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "../../../shared/api/client";
import type { CheckpointMedia, Inspection } from "../../../shared/api/types";
import { mediaRefreshMs } from "../../report/api/report";

// 관리자 검사 결과 화면(spec 006)의 서버 상태. 검사 결과는 capture-server, 렌탈 목록·상세는 rentals 기능의 훅을 그대로 쓴다
export const INSPECTIONS = ["inspections"] as const;

/** 판정 대기인 동안 다시 읽는 간격. 렌탈 상세의 시점 재조회(3초)와 같다 */
export const INSPECTION_POLL_MS = 3000;

/**
 * 결과가 아직 없거나(404 → null) 등급도 근거도 없으면 기다리는 중이라 다시 읽고, 등급이 매겨지거나 판정 불가(근거만 있음)가 되면 멈춘다.
 * 부스가 사진을 올리고 capture-server가 등급을 매기는 동안 관리자가 목록·상세를 열어 두어도 판정 대기가 그대로 남지 않게 한다
 */
export function inspectionPollMs(inspection: Inspection | null | undefined): number | false {
  if (inspection === undefined) return false;
  if (inspection === null) return INSPECTION_POLL_MS;
  return inspection.grade === null && inspection.reasons.length === 0 ? INSPECTION_POLL_MS : false;
}

/** 한 시점의 검사 결과. 아직 없으면(404) 오류가 아니라 null(판정 대기). 404는 다시 시도하지 않고 기다리는 동안만 주기적으로 다시 읽는다 */
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
    refetchInterval: (query) => (query.state.status === "success" ? inspectionPollMs(query.state.data) : false),
  });
}

/** 한 시점의 사진 보기 주소(원본 사진·면 사진). 아직 없으면(404) null이고 판정처럼 3초마다 다시 읽는다. 주소는 만료 전에 새로 받는다 */
export function useCheckpointMedia(checkpointId: string | undefined) {
  return useQuery<CheckpointMedia | null>({
    queryKey: [...INSPECTIONS, "media", checkpointId],
    queryFn: async () => {
      try {
        return await unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/media", { params: { path: { checkpointId: checkpointId ?? "" } } }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!checkpointId,
    retry: false,
    refetchInterval: (query) => {
      if (query.state.status !== "success") return false;
      return query.state.data ? mediaRefreshMs(query.state.data.expiresAt) : INSPECTION_POLL_MS;
    },
  });
}

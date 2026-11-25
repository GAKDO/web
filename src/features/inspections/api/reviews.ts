import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";
import type { DefectReviewRequest, HumanDefectRequest, Inspection } from "../../../shared/api/types";
import { INSPECTIONS } from "./inspections";

// 사람 검수(11/8): AI가 넓게 잡은 흠집 후보를 관리자가 확정·기각하고, 검수를 완료하면 capture-server가 등급을 매긴다
export const REVIEWS = ["reviews"] as const;

/** 검수 대기 목록을 다시 읽는 간격. 부스가 새로 찍으면 목록에 저절로 나타나게 한다 */
export const REVIEW_QUEUE_POLL_MS = 5000;

/** 검수 대기(PENDING, 오래 기다린 것부터) 또는 검수 완료(CONFIRMED, 최근 것부터) 시점 */
export function useReviewQueue(status: "PENDING" | "CONFIRMED" = "PENDING", limit = 20, pollMs: number | false = REVIEW_QUEUE_POLL_MS, enabled = true) {
  return useQuery({
    queryKey: [...REVIEWS, status, limit],
    queryFn: () => unwrap(api.GET("/api/v1/captures/reviews", { params: { query: { status, limit } } })),
    refetchInterval: pollMs,
    enabled,
  });
}

/** 응답(갱신된 검사 결과)을 바로 화면 캐시에 넣고, 검수 대기 목록도 다시 읽는다 */
function useStoreInspection(checkpointId: string) {
  const client = useQueryClient();
  return (inspection: Inspection) => {
    client.setQueryData([...INSPECTIONS, checkpointId], inspection);
    void client.invalidateQueries({ queryKey: REVIEWS });
  };
}

/** 후보 확정·기각(여러 개 한 번에). 같은 흠집이 조명만 다른 사진마다 있어 묶음 하나를 한 번에 보낸다 */
export function useSaveReviews(checkpointId: string) {
  const store = useStoreInspection(checkpointId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (items: DefectReviewRequest["items"]) =>
      unwrap(api.POST("/api/v1/captures/checkpoints/{checkpointId}/reviews", { params: { path: { checkpointId } }, body: { items } })),
    onSuccess: store,
    // 409(이미 완료) 등으로 실패하면 서버 상태로 다시 맞춘다
    onError: () => void client.invalidateQueries({ queryKey: [...INSPECTIONS, checkpointId] }),
  });
}

/** 검수 완료 → 등급. 버튼을 두 번 눌러도 한 번만 처리되게 키는 화면이 연 동안 하나로 둔다 */
export function useCompleteReview(checkpointId: string, idempotencyKey: string) {
  const store = useStoreInspection(checkpointId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/captures/checkpoints/{checkpointId}/reviews/complete", {
          params: { path: { checkpointId }, header: { "Idempotency-Key": idempotencyKey } },
        }),
      ),
    onSuccess: store,
    onError: () => void client.invalidateQueries({ queryKey: [...INSPECTIONS, checkpointId] }),
  });
}

/** AI가 놓친 흠집 직접 추가(11/9). 관리자가 원본 사진 한 장 위에 그린 다각형(원본 px) */
export function useAddHumanDefect(checkpointId: string) {
  const store = useStoreInspection(checkpointId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: HumanDefectRequest) =>
      unwrap(api.POST("/api/v1/captures/checkpoints/{checkpointId}/reviews/additions", { params: { path: { checkpointId } }, body })),
    onSuccess: store,
    onError: () => void client.invalidateQueries({ queryKey: [...INSPECTIONS, checkpointId] }),
  });
}

/** 직접 추가한 흠집 지우기(11/9). AI 후보는 지울 수 없고 흠집 아님으로 정한다 */
export function useDeleteHumanDefect(checkpointId: string) {
  const store = useStoreInspection(checkpointId);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (defectId: string) =>
      unwrap(api.DELETE("/api/v1/captures/checkpoints/{checkpointId}/reviews/additions/{defectId}", { params: { path: { checkpointId, defectId } } })),
    onSuccess: store,
    onError: () => void client.invalidateQueries({ queryKey: [...INSPECTIONS, checkpointId] }),
  });
}

import type { Checkpoint } from "../../../shared/api/types";
import { useCheckpointInspection } from "../api/inspections";
import { verdictOf, type Verdict } from "../model/verdict";

/** 판정 종류별 배지 색. 문제 있음은 색 + 글자로 함께 구분한다 */
export const VERDICT_CLASS: Record<Verdict["kind"], string> = {
  none: "badge badge-retired",
  pending: "badge badge-maintenance",
  ungradable: "badge badge-retired",
  ok: "badge",
  bad: "badge badge-bad",
};

/** 목록 카드의 판정 글자. 지금 시점의 검사 결과를 하나씩 읽는다(spec 006 FR-003) */
export function VerdictBadge({ checkpoint }: { checkpoint: Checkpoint | null | undefined }) {
  const inspection = useCheckpointInspection(checkpoint?.checkpointId);
  if (checkpoint && inspection.isError) {
    return <span className="badge badge-retired">판정을 읽지 못함</span>;
  }
  const verdict = verdictOf(checkpoint, !checkpoint ? null : inspection.isPending ? "loading" : (inspection.data ?? null));
  return <span className={VERDICT_CLASS[verdict.kind]}>{verdict.label}</span>;
}

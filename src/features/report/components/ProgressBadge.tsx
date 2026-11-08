import type { ProgressEvent } from "../../../shared/api/types";
import { PROGRESS_STAGE_LABEL } from "../../../shared/codes/labels";
import { StepTrail, trailOf } from "../../../shared/motion/StepTrail";

/** report-server 진행 단계 순서(ReportProgressStage). 단계 줄은 이 순서로만 그린다 */
const STAGES = ["UPLOADED", "ALIGNED", "INSPECTED", "GRADED", "SEALED"] as const;

/**
 * 검사 중인 시점의 진행 단계·퍼센트(FR-RPT-04). 퍼센트는 서버가 보낸 값만 보이고, 진행을 아직 모르면 백분율 없이 "기다리는 중".
 * 11/8: 단계 줄(사진 올림 → … → 봉인)을 더해 단계가 바뀔 때 막대가 차오른다. 흠집 검사가 끝나면 직원 확인 뒤 등급이 난다고 적는다
 */
export function ProgressBadge({ event, reconnecting, failed = false }: { event: ProgressEvent | undefined; reconnecting: boolean; failed?: boolean }) {
  const index = event ? STAGES.indexOf(event.stage) : -1;
  // 마지막 받은 단계는 끝난 단계로, 그다음 단계를 진행 중으로 본다(SSE는 단계를 마칠 때 보낸다)
  const steps = trailOf(STAGES.map((s) => PROGRESS_STAGE_LABEL[s]), index + 1);
  return (
    <div className="progress" role="status" aria-live="polite">
      {event ? (
        <>
          <span>
            {PROGRESS_STAGE_LABEL[event.stage]} · {event.percent}%
          </span>
          <progress max={100} value={event.percent} aria-label="검사 진행률" />
        </>
      ) : (
        <span>검사 진행을 기다리는 중</span>
      )}
      <StepTrail steps={steps} label="검사 단계" className="mt-1 w-full basis-full" stalled={failed} />
      {event?.stage === "INSPECTED" && <small className="muted">흠집 후보를 찾았습니다. 직원이 후보를 확인한 뒤 등급이 정해집니다.</small>}
      {reconnecting && <small className="muted">다시 연결 중…</small>}
      {failed && <small className="muted">실시간 진행률을 받지 못했습니다. 새로고침하면 최신 상태를 볼 수 있습니다.</small>}
    </div>
  );
}

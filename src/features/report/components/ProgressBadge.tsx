import type { ProgressEvent } from "../../../shared/api/types";
import { PROGRESS_STAGE_LABEL } from "../../../shared/codes/labels";

/** 검사 중인 시점의 진행 단계·퍼센트(FR-RPT-04) */
export function ProgressBadge({ event, reconnecting }: { event: ProgressEvent | undefined; reconnecting: boolean }) {
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
      {reconnecting && <small className="muted">다시 연결 중…</small>}
    </div>
  );
}

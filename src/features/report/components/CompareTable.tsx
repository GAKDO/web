import type { TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { ApiError } from "../../../shared/api/client";
import { useCheckpointMedia, useDiagnostics } from "../api/report";
import { compareColumn, deltaText, type Reading } from "../model/compare";
import { sliderCheckpoints } from "../model/timeline";

function ReadingText({ reading }: { reading: Reading }) {
  return reading.kind === "value" ? <>{reading.text}</> : <span className="muted">읽지 못함 ({reading.reason})</span>;
}

function Column({ checkpoint, isFirst }: { checkpoint: TimelineCheckpoint; isFirst: boolean }) {
  const diag = useDiagnostics(checkpoint.checkpointId);
  const media = useCheckpointMedia(checkpoint.checkpointId);
  // 404는 "진단 기록 없음", 그 밖의 오류는 "불러오지 못함" + 다시 시도
  const diagFailed = diag.isError && !(diag.error instanceof ApiError && diag.error.status === 404);
  const col = compareColumn(checkpoint, diag.data ?? null, diagFailed);
  const crops = media.data?.crops.filter((c) => col.newDefectIds.includes(c.defectId)) ?? [];
  const cropsMissing = !media.isPending && col.newDefectIds.length > crops.length;
  const label = CHECKPOINT_TYPE_LABEL[col.type];
  const dropped = col.batteryDeltaPct != null && col.batteryDeltaPct < 0;
  return (
    <section className="compare-col" aria-label={`${label} 비교`}>
      <h3>{label}</h3>
      <dl>
        <dt>등급</dt>
        <dd>{col.grade ?? "—"}</dd>
        <dt>신규 흠집</dt>
        <dd className={col.newDefectCount > 0 ? "warn" : undefined}>
          {isFirst ? "기준 시점" : `${col.newDefectCount}개`}
          {crops.length > 0 && (
            <span className="crops">
              {crops.map((c) => (
                <img key={c.defectId} src={c.url} alt={`${label} 신규 흠집 사진`} width={64} height={64} />
              ))}
            </span>
          )}
          {cropsMissing && <span className="muted"> (사진 없음)</span>}
        </dd>
        <dt>배터리 최대 용량</dt>
        <dd className={dropped ? "warn" : undefined}>
          <ReadingText reading={col.battery} />
          {col.batteryDeltaPct != null ? ` (${deltaText(col.batteryDeltaPct)})` : !isFirst ? " (비교할 이전 시점 없음)" : ""}
        </dd>
        {diagFailed && (
          <dd className="full">
            <button type="button" onClick={() => void diag.refetch()}>
              진단 다시 불러오기
            </button>
          </dd>
        )}
        <dt>배터리 충전 횟수</dt>
        <dd>
          <ReadingText reading={col.cycles} />
        </dd>
        <dt>저장장치(SSD)</dt>
        <dd>
          <ReadingText reading={col.ssd} />
        </dd>
        <dt>점검 알림</dt>
        <dd>{col.flags.length === 0 ? "없음" : <ul className="flags">{col.flags.map((f) => <li key={f} className="warn">{f}</li>)}</ul>}</dd>
      </dl>
    </section>
  );
}

/** 시점 비교표(FR-RPT-03). 봉인된 시점만 나란히 놓고, 직전보다 나빠진 값은 강조한다 */
export function CompareTable({ checkpoints }: { checkpoints: TimelineCheckpoint[] }) {
  const sealed = sliderCheckpoints(checkpoints);
  if (sealed.length === 0) return null;
  return (
    <section aria-labelledby="compare-title">
      <h2 id="compare-title">시점 비교</h2>
      <div className="compare">
        {sealed.map((c, i) => (
          <Column key={c.checkpointId} checkpoint={c} isFirst={i === 0} />
        ))}
      </div>
    </section>
  );
}

import type { TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";

interface Props {
  checkpoints: TimelineCheckpoint[];
  index: number;
  onChange(index: number): void;
}

/** 시점 슬라이더(FR-012·015). 봉인된 시점만 올리고, 화살표 키로도 움직인다 */
export function CheckpointSlider({ checkpoints, index, onChange }: Props) {
  if (checkpoints.length === 0) return <p className="text-muted-foreground">아직 확정된 검사 기록이 없습니다. 부스 검사가 끝나고 기록이 확정(봉인)되면 이곳에 사진과 흠집 표시가 나옵니다.</p>;
  const current = checkpoints[index];
  return (
    <div className="slider">
      <input
        type="range"
        min={0}
        max={checkpoints.length - 1}
        step={1}
        value={index}
        aria-label="시점"
        aria-valuetext={CHECKPOINT_TYPE_LABEL[current.type]}
        disabled={checkpoints.length === 1}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          // 화살표 키 한 번 = 시점 한 칸. 브라우저마다 다른 range 키 동작 대신 직접 맞춘다
          const step = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
          if (!step) return;
          e.preventDefault();
          onChange(Math.min(checkpoints.length - 1, Math.max(0, index + step)));
        }}
      />
      <ol className="slider-ticks" aria-hidden="true">
        {checkpoints.map((c, i) => (
          <li key={c.checkpointId} className={i === index ? "on" : undefined}>
            {CHECKPOINT_TYPE_LABEL[c.type]}
          </li>
        ))}
      </ol>
    </div>
  );
}

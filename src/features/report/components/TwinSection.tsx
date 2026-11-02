import { useState } from "react";
import type { Pin, TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { useCheckpointMedia, useInspection } from "../api/report";
import { orderedCheckpoints, sliderCheckpoints } from "../model/timeline";
import { CheckpointSlider } from "./CheckpointSlider";
import { PinDetail } from "./PinDetail";
import { PinList } from "./PinList";
import { TwinFallback } from "./TwinFallback";

/** WebGL을 쓸 수 있는지. 테스트(jsdom)와 WebGL이 꺼진 브라우저는 false → 면별 사진(FR-010) */
export function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface Props {
  /** 3D 뷰어(다음 PR)가 기종 치수를 받을 때 쓴다 */
  modelCode: string;
  checkpoints: TimelineCheckpoint[];
}

/** 3D 트윈 + 시점 슬라이더 + 흠집 목록(FR-RPT-01·02) */
export function TwinSection({ checkpoints }: Props) {
  const sealed = sliderCheckpoints(checkpoints);
  const [index, setIndex] = useState(Math.max(0, sealed.length - 1));
  const [selected, setSelected] = useState<Pin | null>(null);
  const current = sealed[Math.min(index, sealed.length - 1)];
  const media = useCheckpointMedia(current?.checkpointId);
  const inspection = useInspection(current?.checkpointId);
  const [webgl] = useState(hasWebGL);
  const pending = orderedCheckpoints(checkpoints).filter((c) => c.status !== "SEALED");
  const pins = current?.pins ?? [];

  // 3D 뷰어는 다음 PR에서 붙인다. 지금은 면별 사진으로 보여 준다(FR-010)
  const fallbackReason = webgl ? "3D 보기를 준비하고 있습니다. 면별 사진으로 보여 드립니다." : "이 브라우저에서는 3D를 볼 수 없어 면별 사진으로 보여 드립니다.";

  return (
    <section aria-labelledby="twin-title" className="twin">
      <h2 id="twin-title">3D로 보기{current ? ` · ${CHECKPOINT_TYPE_LABEL[current.type]}` : ""}</h2>
      <CheckpointSlider
        checkpoints={sealed}
        index={Math.min(index, Math.max(0, sealed.length - 1))}
        onChange={(i) => {
          setIndex(i);
          setSelected(null);
        }}
      />
      {pending.map((c) => (
        <p key={c.checkpointId} className="muted">
          {CHECKPOINT_TYPE_LABEL[c.type]}: 검사 중이라 아직 볼 수 없습니다.
        </p>
      ))}
      {current && (
        <div className="twin-body">
          <TwinFallback media={media.data} reason={fallbackReason} />
          <div className="twin-side">
            <PinList pins={pins} selected={selected?.defectId ?? null} onSelect={setSelected} />
            {selected && <PinDetail pin={selected} inspection={inspection.data} media={media.data} onClose={() => setSelected(null)} />}
          </div>
        </div>
      )}
    </section>
  );
}

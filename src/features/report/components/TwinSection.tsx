import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import type { Pin, TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { useCheckpointMedia, useDeviceModel, useInspection } from "../api/report";
import { orderedCheckpoints, sliderCheckpoints } from "../model/timeline";
import { CheckpointSlider } from "./CheckpointSlider";
import { PinDetail } from "./PinDetail";
import { PinList } from "./PinList";
import { TwinFallback } from "./TwinFallback";

const TwinViewer = lazy(() => import("./TwinViewer"));

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

/** 3D가 그리다 실패하면 면별 사진으로 바꾼다 */
class TwinBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  modelCode: string;
  checkpoints: TimelineCheckpoint[];
}

/** 3D 트윈 + 시점 슬라이더 + 흠집 목록(FR-RPT-01·02) */
export function TwinSection({ modelCode, checkpoints }: Props) {
  const sealed = sliderCheckpoints(checkpoints);
  const [index, setIndex] = useState(Math.max(0, sealed.length - 1));
  const [selected, setSelected] = useState<Pin | null>(null);
  const current = sealed[Math.min(index, sealed.length - 1)];
  const model = useDeviceModel(modelCode);
  const media = useCheckpointMedia(current?.checkpointId);
  const inspection = useInspection(current?.checkpointId);
  const [webgl] = useState(hasWebGL);
  const pending = orderedCheckpoints(checkpoints).filter((c) => c.status !== "SEALED");
  const pins = current?.pins ?? [];

  const fallbackReason = !webgl
    ? "이 브라우저에서는 3D를 볼 수 없어 면별 사진으로 보여 드립니다."
    : model.isError
      ? "3D 모델을 불러오지 못했습니다. 면별 사진으로 보여 드립니다."
      : "3D를 그리지 못했습니다. 면별 사진으로 보여 드립니다.";
  const fallback = media.isPending ? <p role="status">사진을 불러오는 중…</p> : <TwinFallback media={media.data} reason={fallbackReason} />;
  const dimensions = model.data?.dimensions;

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
          {media.isError && (
            <div role="alert" className="notice">
              <p>사진을 불러오지 못했습니다.</p>
              <button type="button" onClick={() => void media.refetch()}>
                사진 다시 불러오기
              </button>
            </div>
          )}
          {webgl && dimensions && !model.isError ? (
            <TwinBoundary fallback={fallback}>
              <Suspense fallback={<p>3D를 준비하는 중…</p>}>
                <TwinViewer dimensions={dimensions} media={media.data} pins={pins} selected={selected?.defectId ?? null} onSelect={setSelected} />
              </Suspense>
            </TwinBoundary>
          ) : webgl && model.isPending ? (
            <p>3D를 준비하는 중…</p>
          ) : (
            fallback
          )}
          <div className="twin-side">
            <PinList pins={pins} selected={selected?.defectId ?? null} onSelect={setSelected} />
            {selected && (
              <PinDetail
                pin={selected}
                inspection={inspection.data}
                inspectionError={inspection.isError}
                onRetry={() => void inspection.refetch()}
                media={media.data}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

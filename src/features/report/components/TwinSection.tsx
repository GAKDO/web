import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import type { Pin, TimelineCheckpoint } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { useCheckpointMedia, useDeviceModel, useInspection } from "../api/report";
import { orderedCheckpoints, sliderCheckpoints } from "../model/timeline";
import { CheckpointSlider } from "./CheckpointSlider";
import { PinDetail } from "./PinDetail";
import { PinList } from "./PinList";
import { TwinFallback } from "./TwinFallback";
import { PhotoGrid } from "../../inspections/components/PhotoGrid";
import { faceGrids, photoDefectsOf } from "../../inspections/model/photos";
import { usePhotoSizes } from "../../../shared/laptop3d/usePhotoSizes";
import { quickShapes, SHAPE_KNOWN, standardShapes } from "../model/twinShapes";

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
  // 부스 빠른 검사(QUICK)는 면 사진(textures)이 없고 흠집이 원본 사진 px(photoDefects)다.
  // 9면 3D·면별 사진으로는 '사진 없음'만 보이므로 관리자 검사 결과와 같은 원본 사진 격자로 보여 준다
  const photoDefects = photoDefectsOf(inspection.data);
  const photos = media.data?.photos ?? [];
  const quick = photoDefects.length > 0 || (photos.length > 0 && (media.data?.textures ?? []).length === 0);

  // 3D 위에 그릴 실제 흠집 모양: 정합 검사는 표준 좌표 폴리곤, 빠른 검사는 원본 사진 px 폴리곤(대표 하나씩)
  const textureSizes = usePhotoSizes(useMemo(() => (media.data?.textures ?? []).map((t) => ({ key: t.face, url: t.url })), [media.data]));
  const photoKey = (p: { face: string; camera: string; light: string }) => `${p.face}:${p.camera}:${p.light}`;
  const photoSizes = usePhotoSizes(useMemo(() => photos.filter((p) => photoDefects.some((d) => photoKey(d) === photoKey(p))).map((p) => ({ key: photoKey(p), url: p.url })), [photos, photoDefects]));
  const dims = model.data?.dimensions;
  const shapes = useMemo(() => {
    if (!dims) return [];
    if (quick) return quickShapes(photoDefects, (d) => photoSizes[photoKey(d)]);
    return standardShapes(inspection.data, dims, textureSizes, new Set(pins.filter((p) => p.isNew).map((p) => p.defectId)), selected?.defectId ?? null);
  }, [dims, quick, photoDefects, photoSizes, inspection.data, textureSizes, pins, selected]);

  const fallbackReason = !webgl
    ? "이 브라우저에서는 3D를 볼 수 없어 면별 사진으로 보여 드립니다."
    : model.isError
      ? "3D 모델을 불러오지 못했습니다. 면별 사진으로 보여 드립니다."
      : "3D를 그리지 못했습니다. 면별 사진으로 보여 드립니다.";
  const fallback = media.isPending ? <p role="status">사진을 불러오는 중…</p> : <TwinFallback media={media.data} reason={fallbackReason} />;
  const dimensions = model.data?.dimensions;

  return (
    <section aria-labelledby="twin-title" className="twin">
      <h2 id="twin-title">
        {quick && !(webgl && dimensions && !model.isError) ? "부스 사진" : "3D로 보기"}
        {current ? ` · ${CHECKPOINT_TYPE_LABEL[current.type]}` : ""}
      </h2>
      <CheckpointSlider
        checkpoints={sealed}
        index={Math.min(index, Math.max(0, sealed.length - 1))}
        onChange={(i) => {
          setIndex(i);
          setSelected(null);
        }}
      />
      {pending.map((c) => (
        <p key={c.checkpointId} className="muted m-0 text-sm">
          {CHECKPOINT_TYPE_LABEL[c.type]}: 검사 중이라 아직 볼 수 없습니다.
        </p>
      ))}
      {inspection.data?.ruleVersion && (
        // 흠집이 없는 검사도 어떤 규칙으로 판정했는지 보이도록 핀 선택과 상관없이 둔다(defect_match.rule_version)
        <p className="muted mt-0 mb-3 text-sm">판정 규칙: {inspection.data.ruleVersion}</p>
      )}
      {current && quick && webgl && dimensions && !model.isError && (
        <div className="twin-body">
          <TwinBoundary fallback={null}>
            <Suspense fallback={<p>3D를 준비하는 중…</p>}>
              <TwinViewer dimensions={dimensions} modelCode={modelCode} sizes={{}} shapes={shapes} pins={[]} selected={null} onSelect={() => undefined} />
            </Suspense>
          </TwinBoundary>
          <div className="twin-side text-sm">
            <p className="m-0 font-semibold">흠집 {shapes.length}곳 <span className="font-normal text-muted-foreground">(조명만 다른 사진의 같은 흠집은 한 곳으로 셈)</span></p>
            <p className="muted m-0">부스 사진에서 찾은 실제 흠집 모양을 노트북 모형 위에 옮겨 그렸습니다. 위치는 사진에서 옮긴 대략 위치이고, 정확한 모습은 아래 사진에서 볼 수 있습니다.</p>
            <p className="m-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SHAPE_KNOWN }} />
              이 시점은 앞 기록과 비교하지 않아 모두 같은 색입니다.
            </p>
          </div>
        </div>
      )}
      {current && quick && (
        <div>
          <p className="muted">
            부스에서 찍은 사진 {photos.length}장
            {photoDefects.length > 0 ? ` · 사진 속 표시 ${photoDefects.length}개` : " · 표시된 흠집 없음"}
          </p>
          <PhotoGrid grids={faceGrids(photos, photoDefects)} />
        </div>
      )}
      {current && !quick && (
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
                <TwinViewer dimensions={dimensions} modelCode={modelCode} sizes={textureSizes} shapes={shapes} pins={pins} selected={selected?.defectId ?? null} onSelect={setSelected} />
              </Suspense>
            </TwinBoundary>
          ) : webgl && model.isPending ? (
            <p>3D를 준비하는 중…</p>
          ) : (
            fallback
          )}
          <div className="twin-side">
            <NewDefectSummary checkpoint={current} pins={pins} previous={previousName(sealed, current)} />
            <PinList pins={pins} selected={selected?.defectId ?? null} onSelect={setSelected} />
            {selected && (
              <PinDetail
                key={selected.defectId}
                pin={selected}
                checkpointType={current.type}
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

/** 바로 앞 봉인 시점 이름(출고·수령). 앞 시점이 없으면 null */
function previousName(sealed: TimelineCheckpoint[], current: TimelineCheckpoint): string | null {
  const i = sealed.findIndex((c) => c.checkpointId === current.checkpointId);
  return i > 0 ? CHECKPOINT_TYPE_LABEL[sealed[i - 1].type] : null;
}

/**
 * 전후 비교 요약(11/8 민서: 2D 사진 비교 대신 3D 핀으로). 신규 여부는 서버 판정(pin.isNew)만 쓰고,
 * 비교하지 않은 시점(출고·빠른 검사, compared=false)에는 "신규 없음"으로 읽히지 않게 이유만 적는다
 */
function NewDefectSummary({ checkpoint, pins, previous }: { checkpoint: TimelineCheckpoint; pins: Pin[]; previous: string | null }) {
  const compared = checkpoint.type !== "OUT" && checkpoint.compared !== false && previous !== null;
  const fresh = pins.filter((p) => p.isNew).length;
  return (
    <div className="grid gap-1.5 text-sm">
      {compared ? (
        <p className="m-0 font-semibold">
          {previous} 기록과 비교 ·{" "}
          {fresh > 0 ? <span className="text-brand">새로 생긴 흠집 {fresh}개</span> : "새로 생긴 흠집 없음"}
        </p>
      ) : (
        <p className="muted m-0">{checkpoint.type === "OUT" ? "출고 기록은 이후 비교의 기준이라 신규 표시가 없습니다." : "이 시점은 앞 기록과 비교하지 않았습니다."}</p>
      )}
      <ul aria-label="핀 색" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SHAPE_KNOWN }} />
          앞 시점부터 있던 흠집
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand ring-2 ring-brand/35 ring-offset-1" />
          새로 생긴 흠집(신규)
        </li>
      </ul>
    </div>
  );
}

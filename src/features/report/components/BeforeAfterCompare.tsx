import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineCheckpoint } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { usePlayback } from "../../../shared/motion/usePlayback";
import { useCheckpointMedia, useInspection } from "../api/report";
import { beforeAfter, boundsOf, previousOf, type CompareFace, type CompareMark } from "../model/beforeAfter";
import { orderedCheckpoints } from "../model/timeline";
import { polygonPoints } from "../../inspections/model/photos";

/** 비교 선이 사진을 왼쪽에서 오른쪽으로 지나가는 시간(초). 새 흠집 표시는 선이 그 자리에 닿을 때 나타난다 */
const WIPE_DELAY_S = 0.3;
const WIPE_S = 2.2;

/** 비교할 수 있는 짝(직전 시점도 봉인된 수령·반납) */
function comparablePairs(checkpoints: TimelineCheckpoint[]) {
  const ordered = orderedCheckpoints(checkpoints);
  return ordered.flatMap((c) => {
    if (c.status !== "SEALED" || c.type === "OUT") return [];
    const prev = previousOf(ordered, c);
    return prev ? [{ current: c, previous: prev }] : [];
  });
}

/**
 * 리포트의 전후 비교(11/8 ③). 직전 시점과 이번 시점의 같은 면 사진을 나란히 놓고 비교 선이 지나가면,
 * 앞 시점부터 있던 흠집은 회색 선, 이번에 새로 생긴 흠집만 빨간색과 "신규"로 강조한다.
 * 사진·폴리곤·새 흠집 여부는 모두 서버 기록(textures·defects·match)이고, 비교하지 않은 시점이면 이유만 적는다
 */
export function BeforeAfterCompare({ checkpoints }: { checkpoints: TimelineCheckpoint[] }) {
  const pairs = comparablePairs(checkpoints);
  const [picked, setPicked] = useState<string | null>(null);
  const pair = pairs.find((p) => p.current.checkpointId === picked) ?? pairs[pairs.length - 1];
  if (!pair) return null;
  return (
    <section aria-labelledby="before-after-title" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="before-after-title" className="m-0 text-xl font-bold tracking-tight">
            전후 비교
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {CHECKPOINT_TYPE_LABEL[pair.previous.type]} 사진과 {CHECKPOINT_TYPE_LABEL[pair.current.type]} 사진의 같은 자리를 나란히 봅니다.
          </p>
        </div>
        {pairs.length > 1 && (
          <div role="group" aria-label="비교할 시점" className="inline-flex rounded-full border p-1">
            {pairs.map((p) => {
              const on = p.current.checkpointId === pair.current.checkpointId;
              return (
                <button
                  key={p.current.checkpointId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(p.current.checkpointId)}
                  className={cn("h-9 cursor-pointer rounded-full border-0 px-3.5 text-sm transition-colors", on ? "bg-foreground text-background" : "bg-transparent text-muted-foreground hover:text-foreground")}
                >
                  {CHECKPOINT_TYPE_LABEL[p.previous.type]} ↔ {CHECKPOINT_TYPE_LABEL[p.current.type]}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <PairCompare key={pair.current.checkpointId} current={pair.current} previous={pair.previous} />
    </section>
  );
}

function PairCompare({ current, previous }: { current: TimelineCheckpoint; previous: TimelineCheckpoint }) {
  const currentInspection = useInspection(current.checkpointId);
  const previousInspection = useInspection(previous.checkpointId);
  const currentMedia = useCheckpointMedia(current.checkpointId);
  const previousMedia = useCheckpointMedia(previous.checkpointId);
  const loading = currentInspection.isPending || previousInspection.isPending || currentMedia.isPending || previousMedia.isPending;
  const failed = currentInspection.isError || previousInspection.isError || currentMedia.isError || previousMedia.isError;

  if (loading) return <p className="mt-4 text-sm text-muted-foreground" role="status">비교할 사진을 불러오는 중…</p>;
  if (failed) {
    return (
      <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
        비교할 사진이나 검사 기록을 불러오지 못했습니다.
        <button
          type="button"
          className="cursor-pointer rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-sm text-foreground"
          onClick={() => {
            void currentInspection.refetch();
            void previousInspection.refetch();
            void currentMedia.refetch();
            void previousMedia.refetch();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }
  const result = beforeAfter({
    current,
    previous,
    currentInspection: currentInspection.data,
    previousInspection: previousInspection.data,
    currentMedia: currentMedia.data,
    previousMedia: previousMedia.data,
  });
  if (result.status === "unavailable") return <p className="mt-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">{result.reason}</p>;
  return (
    <>
      <p className="m-0 mt-4 text-sm font-medium">{result.newCount > 0 ? `새로 생긴 흠집 ${result.newCount}개` : "새로 생긴 흠집 없음 · 기록된 흠집은 모두 앞 시점부터 있던 것"}</p>
      <div className="mt-4 grid gap-8">
        {result.faces.map((face) => (
          <FacePair key={face.face} face={face} beforeLabel={CHECKPOINT_TYPE_LABEL[previous.type]} afterLabel={CHECKPOINT_TYPE_LABEL[current.type]} />
        ))}
      </div>
      <ul aria-label="표시 뜻" className="m-0 mt-5 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border-2 border-zinc-500" />앞 시점부터 있던 흠집
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border-2 border-brand bg-brand/25" />새로 생긴 흠집(신규)
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border-2 border-dashed border-zinc-500" />앞 사진의 같은 자리
        </li>
      </ul>
    </>
  );
}

/** 한 면의 앞·뒤 사진. 화면에 들어오면 비교 선이 한 번 지나간다 */
function FacePair({ face, beforeLabel, afterLabel }: { face: CompareFace; beforeLabel: string; afterLabel: string }) {
  const play = usePlayback<HTMLDivElement>();
  const faceLabel = CAPTURE_FACE_LABEL[face.face];
  return (
    <div ref={play.ref} {...play.attrs} className="m-scene m-compare">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold">
          {faceLabel}
          {face.newCount > 0 && <span className="ml-2 text-sm font-semibold text-brand">신규 {face.newCount}</span>}
        </h3>
        <button type="button" className="m-replay" onClick={play.replay}>
          <RotateCcw aria-hidden="true" className="size-3.5" />
          다시 보기
        </button>
      </div>
      <div key={play.runKey} className="grid gap-3 sm:grid-cols-2">
        <ComparePhoto label={`${beforeLabel} 기록`} alt={`${beforeLabel} ${faceLabel} 사진`} url={face.beforeUrl} marks={face.before} />
        <ComparePhoto label={`${afterLabel} 기록`} alt={`${afterLabel} ${faceLabel} 사진`} url={face.afterUrl} marks={face.after} wipe />
      </div>
    </div>
  );
}

function markTitle(kind: CompareMark["kind"]): string {
  return kind === "new" ? "새로 생긴 흠집" : kind === "spot" ? "새 흠집과 같은 자리(이때는 없음)" : "앞 시점부터 있던 흠집";
}

/** 사진 위 흠집 겹침. 좌표는 사진 px라 로드 뒤 natural 크기를 viewBox로 써서 어떤 크기에서도 같은 자리에 그린다 */
function ComparePhoto({ label, alt, url, marks, wipe = false }: { label: string; alt: string; url: string; marks: CompareMark[]; wipe?: boolean }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const newCount = marks.filter((m) => m.kind === "new").length;
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-1.5 text-sm text-muted-foreground">{label}</figcaption>
      <div className="relative overflow-hidden rounded-lg border bg-muted leading-none">
        {failed ? (
          <p className="m-0 grid aspect-[4/3] place-items-center p-3 text-sm text-muted-foreground">사진을 불러오지 못함</p>
        ) : (
          <img
            className="block h-auto w-full"
            src={url}
            alt={newCount > 0 ? `${alt}, 새로 생긴 흠집 ${newCount}개 표시` : alt}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) setSize({ width: naturalWidth, height: naturalHeight });
            }}
            onError={() => setFailed(true)}
          />
        )}
        {size && !failed && (
          <>
            <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
              {marks.map((m) => (
                <polygon
                  key={m.id}
                  points={polygonPoints(m.polygon)}
                  vectorEffect="non-scaling-stroke"
                  className={cn("m-compare-mark", `m-compare-${m.kind}`)}
                  style={m.kind === "new" ? ({ animationDelay: `${appearAt(m, size.width)}s` } as CSSProperties) : undefined}
                >
                  <title>{markTitle(m.kind)}</title>
                </polygon>
              ))}
            </svg>
            {marks
              .filter((m) => m.kind === "new")
              .map((m) => {
                const b = boundsOf(m.polygon);
                return (
                  <span
                    key={`tag-${m.id}`}
                    aria-hidden="true"
                    className="m-compare-tag"
                    style={{
                      left: `${Math.min(88, (b.minX / size.width) * 100)}%`,
                      top: `${Math.max(0, (b.minY / size.height) * 100)}%`,
                      animationDelay: `${appearAt(m, size.width)}s`,
                    }}
                  >
                    신규
                  </span>
                );
              })}
            {wipe && <span aria-hidden="true" className="m-compare-wipe" style={{ "--m-wipe-s": `${WIPE_S}s`, "--m-wipe-delay": `${WIPE_DELAY_S}s` } as CSSProperties} />}
          </>
        )}
      </div>
    </figure>
  );
}

/** 비교 선이 흠집 가운데에 닿는 시각(초) */
function appearAt(mark: CompareMark, width: number): number {
  const b = boundsOf(mark.polygon);
  const frac = Math.min(1, Math.max(0, (b.minX + b.maxX) / 2 / width));
  return Number((WIPE_DELAY_S + frac * WIPE_S).toFixed(2));
}

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import type { CheckpointPhoto, DefectClass, Inspection } from "../../../shared/api/types";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCheckpointMedia } from "../api/inspections";
import { useAddHumanDefect, useDeleteHumanDefect } from "../api/reviews";
import { pathPolygon, pointPolygon, pointRadius, strokePolygon } from "../model/draw";
import { isQuickInspection, photoDefectsOf, polygonPoints, unjudgeableOf } from "../model/photos";
import { humanDefects } from "../model/review";

/** 표시 방법: 점 하나 · 선 긋기(긴 긁힘) · 테두리 따라 그리기(찍힘·넓은 자국) */
export type DrawMode = "point" | "line" | "outline";
const MODE_LABEL: Record<DrawMode, string> = { point: "점 찍기", line: "선 긋기", outline: "테두리 그리기" };
const MODE_HINT: Record<DrawMode, string> = {
  point: "흠집 자리를 한 번 누르세요.",
  line: "긁힘을 따라 누른 채로 끌어 주세요.",
  outline: "자국 둘레를 누른 채로 한 바퀴 그려 주세요.",
};
const CLASSES = Object.keys(DEFECT_CLASS_LABEL) as DefectClass[];

const photoKey = (p: { face: string; camera: string; light: string }) => `${p.face}:${p.camera}:${p.light}`;
const photoName = (p: Pick<CheckpointPhoto, "face" | "camera" | "light">) =>
  `${CAPTURE_FACE_LABEL[p.face]} · ${CAPTURE_CAMERA_LABEL[p.camera]} · ${CAPTURE_LIGHT_LABEL[p.light]}`;

const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");

interface Shape {
  id: string;
  polygon: number[][];
  human: boolean;
}

/**
 * 사진 위에 그리는 칸. 사진 natural 크기를 SVG viewBox로 써서 누른 자리를 원본 px로 바꾼다(화면 크기와 무관).
 * 폰에서도 그릴 수 있게 pointer 이벤트로 받고 touch-action을 끈다
 */
function DrawCanvas({ src, alt, shapes, draft, mode, onDraft }: { src: string; alt: string; shapes: Shape[]; draft: number[][] | null; mode: DrawMode; onDraft(polygon: number[][] | null): void }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [path, setPath] = useState<number[][] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toPhoto = (e: ReactPointerEvent<SVGSVGElement>): number[] | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !size || rect.width === 0 || rect.height === 0) return null;
    return [((e.clientX - rect.left) / rect.width) * size.width, ((e.clientY - rect.top) / rect.height) * size.height];
  };

  const finish = (points: number[][]) => {
    if (!size || points.length === 0) return;
    const r = pointRadius(size.width, size.height);
    const [x, y] = points[0];
    const shaped = mode === "line" ? strokePolygon(points, Math.max(4, r / 2), size.width, size.height) : mode === "outline" ? pathPolygon(points, size.width, size.height) : null;
    // 너무 짧게 그었으면 점 표시로 바꾼다
    onDraft(shaped ?? pointPolygon(x, y, r, size.width, size.height));
  };

  return (
    <div className="relative mx-auto w-[min(100%,calc(62vh*4/3))] overflow-hidden rounded-md bg-muted leading-none">
      <img className="block h-auto w-full select-none" src={src} alt={alt} draggable={false} onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />
      {size && (
        <svg
          ref={svgRef}
          className="absolute inset-0 size-full cursor-crosshair touch-none"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          role="application"
          aria-label={`${alt}: ${MODE_HINT[mode]}`}
          onPointerDown={(e) => {
            const p = toPhoto(e);
            if (!p) return;
            if (mode === "point") {
              finish([p]);
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            setPath([p]);
          }}
          onPointerMove={(e) => {
            if (!path) return;
            const p = toPhoto(e);
            if (p) setPath([...path, p]);
          }}
          onPointerUp={() => {
            if (!path) return;
            finish(path);
            setPath(null);
          }}
          onPointerCancel={() => setPath(null)}
        >
          {shapes.map((s) => (
            <polygon key={s.id} points={polygonPoints(s.polygon)} vectorEffect="non-scaling-stroke" strokeWidth={2} className={s.human ? "fill-sky-500/25 stroke-sky-500" : "fill-destructive/20 stroke-destructive"} />
          ))}
          {path && <polyline points={polygonPoints(path)} vectorEffect="non-scaling-stroke" strokeWidth={2} className="fill-none stroke-amber-400" />}
          {draft && <polygon data-testid="draft" points={polygonPoints(draft)} vectorEffect="non-scaling-stroke" strokeWidth={3} className="fill-amber-400/30 stroke-amber-400 [stroke-dasharray:6_3]" />}
        </svg>
      )}
    </div>
  );
}

/**
 * AI가 놓친 흠집 직접 표시(11/9 민서 요청). 원본 사진 한 장을 골라 점·선·테두리로 표시하고 종류를 고르면 서버가 사람이 표시한 흠집(확정)으로
 * 저장해 등급·고객 리포트에 넣는다. 잘못 그린 것은 검수 완료 전까지 지울 수 있다
 */
export function MissedDefectEditor({ checkpointId, inspection }: { checkpointId: string; inspection: Inspection }) {
  const media = useCheckpointMedia(checkpointId);
  const add = useAddHumanDefect(checkpointId);
  const remove = useDeleteHumanDefect(checkpointId);
  const quick = isQuickInspection(inspection);
  // 전체 검사는 판정 불가 면에 그려도 등급에 쓰지 않으므로(서버 400) 고를 수 없게 한다
  const blocked = useMemo(() => new Set(quick ? [] : unjudgeableOf(inspection).map((u) => u.face)), [quick, inspection]);
  const photos = media.data?.photos ?? [];
  const [key, setKey] = useState<string | null>(null);
  const [mode, setMode] = useState<DrawMode>("point");
  const [cls, setCls] = useState<DefectClass>("scratch");
  const [draft, setDraft] = useState<number[][] | null>(null);
  const added = humanDefects(inspection);
  const usable = photos.filter((p) => !blocked.has(p.face));
  const photo = usable.find((p) => photoKey(p) === key) ?? usable[0];
  const shapes: Shape[] = photo
    ? photoDefectsOf(inspection)
        .filter((d) => photoKey(d) === photoKey(photo) && d.review?.status !== "DISMISSED")
        .map((d) => ({ id: d.defectId, polygon: d.polygon, human: d.source === "HUMAN" }))
    : [];
  const error = add.error ?? remove.error;

  if (media.isPending) return <p className="text-sm text-muted-foreground">사진 불러오는 중…</p>;
  if (!photo) return <p className="text-sm text-muted-foreground">표시할 수 있는 원본 사진이 없습니다.</p>;

  return (
    <section aria-labelledby="missed-title" className="mt-4 grid gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div>
        <h3 id="missed-title" className="m-0 text-base font-semibold">AI가 놓친 흠집 직접 표시 · {added.length}개</h3>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">
          조명에 가려 AI가 못 잡은 흠집이 보이면 사진을 고르고 표시하세요. 표시한 흠집은 <strong className="text-sky-600">파란 선</strong>으로 보이고, 판정·등급과 고객 리포트에 들어갑니다.
        </p>
      </div>
      {error && <ErrorBanner message={toMessage(error)} />}
      <label className="grid gap-1 text-sm">
        <span className="font-medium">사진</span>
        <select
          className="min-h-10 rounded-md border bg-background px-3"
          value={photoKey(photo)}
          onChange={(e) => {
            setKey(e.target.value);
            setDraft(null);
          }}
        >
          {usable.map((p) => (
            <option key={photoKey(p)} value={photoKey(p)}>
              {photoName(p)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="표시 방법">
        {(Object.keys(MODE_LABEL) as DrawMode[]).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </Button>
        ))}
        <span className="self-center text-sm text-muted-foreground">{MODE_HINT[mode]}</span>
      </div>
      <DrawCanvas key={photo.url} src={photo.url} alt={`${photoName(photo)} 사진`} shapes={shapes} draft={draft} mode={mode} onDraft={setDraft} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="흠집 종류">
        {CLASSES.map((c) => (
          <Button key={c} size="sm" variant={cls === c ? "default" : "outline"} aria-pressed={cls === c} onClick={() => setCls(c)}>
            {DEFECT_CLASS_LABEL[c]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          busy={add.isPending}
          disabled={!draft || remove.isPending}
          onClick={() => {
            if (!draft) return;
            add.mutate({ face: photo.face, light: photo.light, camera: photo.camera, class: cls, polygon: draft }, { onSuccess: () => setDraft(null) });
          }}
        >
          이 흠집 추가
        </Button>
        {draft && (
          <Button variant="ghost" onClick={() => setDraft(null)}>
            다시 표시
          </Button>
        )}
      </div>
      {added.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0" aria-label="직접 표시한 흠집">
          {added.map((d, i) => (
            <li key={d.defectId} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm")}>
              <span>
                {i + 1}. {DEFECT_CLASS_LABEL[d.class]} · {photoName(d)}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setKey(photoKey(d))}>
                  사진 보기
                </Button>
                <Button size="sm" variant="ghost" disabled={add.isPending || remove.isPending} onClick={() => remove.mutate(d.defectId)}>
                  지우기
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

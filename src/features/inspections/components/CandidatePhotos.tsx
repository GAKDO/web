import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL } from "../../../shared/codes/labels";
import { cropBox, type CandidateShot } from "../model/candidateShots";
import { polygonPoints } from "../model/photos";
import { formatConfidence } from "../model/verdict";
import { PhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";
import { PHOTO_MISSING, PhotoWithDefects } from "./PhotoWithDefects";

const shotName = (s: CandidateShot) =>
  [CAPTURE_FACE_LABEL[s.face], s.camera ? CAPTURE_CAMERA_LABEL[s.camera] : "정합된 면 사진", s.light && CAPTURE_LIGHT_LABEL[s.light]].filter(Boolean).join(" · ");

/** 사진의 natural 크기(크롭 좌표를 사진 px로 잡으려면 필요). 실패하면 failed */
function useNaturalSize(src: string) {
  const [state, setState] = useState<{ src: string; size: { width: number; height: number } | null; failed: boolean }>({ src, size: null, failed: false });
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setState({ src, size: img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null, failed: img.naturalWidth === 0 });
    img.onerror = () => alive && setState({ src, size: null, failed: true });
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return state.src === src ? state : { size: null, failed: false };
}

/** 후보 주변을 확대한 크롭. SVG viewBox를 크롭 상자로 잡아 사진을 잘라 보이고 그 위에 후보 테두리를 그린다 */
function DefectCrop({ shot, onOpen }: { shot: CandidateShot; onOpen: () => void }) {
  const { size, failed } = useNaturalSize(shot.src);
  if (failed) return <div className={PHOTO_MISSING}>사진을 불러오지 못함</div>;
  if (!size) return <div className={cn(PHOTO_MISSING, "animate-pulse")} aria-hidden="true" />;
  const box = cropBox(shot.polygon, size.width, size.height);
  return (
    <button
      type="button"
      className="relative block w-full cursor-zoom-in overflow-hidden rounded-md border-0 bg-muted p-0 leading-none ring-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring"
      aria-label={`${shotName(shot)} 후보 확대 크게 보기`}
      onClick={onOpen}
    >
      <svg className="block aspect-[4/3] h-auto w-full" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="후보 확대">
        <image href={shot.src} x={0} y={0} width={size.width} height={size.height} />
        <polygon points={polygonPoints(shot.polygon)} vectorEffect="non-scaling-stroke" className="fill-transparent stroke-destructive [stroke-dasharray:6_3]" strokeWidth={2} />
      </svg>
      <span className="absolute top-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-foreground">확대</span>
    </button>
  );
}

/**
 * 검수 후보 카드 안 사진(11/12): 왼쪽은 후보 주변 확대, 오른쪽은 사진 전체에서의 위치.
 * 같은 흠집이 여러 사진(조명·카메라)에서 잡혔으면 아래 버튼으로 바꿔 보고, 누르면 크게 보기에서 차례로 넘긴다
 */
export function CandidatePhotos({ shots }: { shots: CandidateShot[] }) {
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  if (shots.length === 0) return <p className="m-0 text-sm text-muted-foreground">이 후보의 사진을 찾지 못했어요. 아래 검사 사진에서 확인해 주세요.</p>;
  const index = Math.min(current, shots.length - 1);
  const shot = shots[index];
  const lightbox: LightboxPhoto[] = shots.map((s) => ({
    key: s.defectId,
    name: `${shotName(s)} · 신뢰도 ${formatConfidence(s.confidence)}`,
    src: s.src,
    defects: [{ id: s.defectId, title: "검수 후보", polygon: s.polygon }],
  }));
  return (
    <div className="grid gap-2" aria-label="후보 사진">
      <div className="grid grid-cols-2 gap-2">
        <DefectCrop key={shot.src + shot.defectId} shot={shot} onOpen={() => setOpen(index)} />
        <PhotoWithDefects src={shot.src} alt={`${shotName(shot)} 전체`} defects={lightbox[index].defects} onOpen={() => setOpen(index)} />
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {shotName(shot)} · 신뢰도 {formatConfidence(shot.confidence)} · 사진을 누르면 크게 봐요
      </p>
      {shots.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="같은 후보가 잡힌 사진">
          {shots.map((s, i) => (
            <button
              key={s.defectId}
              type="button"
              aria-pressed={i === index}
              onClick={() => setCurrent(i)}
              className={cn(
                "min-h-9 cursor-pointer rounded-md border px-2 text-xs font-medium transition-colors",
                i === index ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {[s.camera && CAPTURE_CAMERA_LABEL[s.camera], s.light && CAPTURE_LIGHT_LABEL[s.light]].filter(Boolean).join(" · ") || CAPTURE_FACE_LABEL[s.face]} {formatConfidence(s.confidence)}
            </button>
          ))}
        </div>
      )}
      {open !== null && <PhotoLightbox photos={lightbox} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

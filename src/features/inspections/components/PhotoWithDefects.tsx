import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { polygonPoints } from "../model/photos";

/** 사진 칸 공통 모양과 사진이 없을 때의 빈 칸(4:3) */
const PHOTO = "relative block overflow-hidden rounded-md bg-muted leading-none";
export const PHOTO_MISSING = cn(PHOTO, "flex aspect-[4/3] flex-col items-center justify-center gap-2 p-2 text-center text-sm leading-snug text-muted-foreground");

export interface OverlayDefect {
  id: string;
  /** 폴리곤 위에 올리면 보이는 설명 */
  title: string;
  polygon: number[][];
  /** 흠집 아님으로 정한 후보: 흐린 점선(11/8 검수) */
  muted?: boolean;
  /** 사람이 직접 표시한 흠집(11/9): 파란 선으로 AI 표시와 구분 */
  human?: boolean;
}

/**
 * 사진 위에 흠집 폴리곤을 겹친다. 폴리곤 좌표는 사진 px(원본 사진이면 원본 px, 면 사진이면 표준 좌표)라
 * 사진이 로드된 뒤 natural 크기를 SVG viewBox로 써서 화면 크기와 상관없이 같은 자리에 그린다.
 * onOpen이 있으면 누를 때 크게 보기 팝업을 열고, 없으면(팝업 안) 원본을 새 탭에 연다.
 * 사진 주소(사전 서명 URL)를 못 읽으면 깨진 그림 대신 안내와 다시 시도를 보인다
 */
export function PhotoWithDefects({
  src,
  alt,
  defects,
  onOpen,
  large = false,
}: {
  src: string;
  alt: string;
  defects: OverlayDefect[];
  onOpen?: () => void;
  /** 크게 보기 팝업 안: 낮은 화면에서도 사진 전체가 보이게 폭을 화면 높이에 맞춰 묶는다 */
  large?: boolean;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // 실패는 그 주소에만 매어 둔다: 사진 주소가 새로 발급되면(만료 전 갱신) 따로 누르지 않아도 새 주소로 다시 읽는다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  if (failedSrc === src) {
    return (
      <div className={PHOTO_MISSING} role="group" aria-label={alt}>
        <span>사진을 불러오지 못함</span>
        <Button
          size="sm"
          onClick={() => {
            setFailedSrc(null);
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }
  const body = (
    <>
      <img
        key={attempt}
        className="block h-auto w-full"
        src={src}
        alt={alt}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) setSize({ width: naturalWidth, height: naturalHeight });
        }}
        onError={() => {
          setSize(null);
          setFailedSrc(src);
        }}
      />
      {size && defects.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 size-full [&_polygon]:fill-destructive/25 [&_polygon]:stroke-destructive [&_polygon]:stroke-2"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`흠집 ${defects.length}개 표시`}
        >
          {defects.map((d) => (
            <polygon
              key={d.id}
              points={polygonPoints(d.polygon)}
              vectorEffect="non-scaling-stroke"
              data-muted={d.muted || undefined}
              data-human={d.human || undefined}
              className={d.muted ? "fill-transparent! stroke-muted-foreground! [stroke-dasharray:6_4]" : d.human ? "fill-sky-500/25! stroke-sky-500!" : undefined}
            >
              <title>{d.title}</title>
            </polygon>
          ))}
        </svg>
      )}
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        className={cn(PHOTO, "w-full cursor-zoom-in border-0 p-0 ring-offset-2 transition hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring")}
        aria-label={`${alt} 크게 보기`} onClick={onOpen}>
        {body}
      </button>
    );
  }
  return (
    <a className={cn(PHOTO, large && "mx-auto w-[min(100%,calc(62vh*4/3))]")} href={src} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  );
}

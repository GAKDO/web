import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LaptopShape } from "./LaptopFigure";
import { usePlayback } from "./usePlayback";

/** QR 모양(장식). 실제 QR이 아니라 읽히지 않는 점 무늬 */
const QR_CELLS = [
  [0, 0], [1, 0], [2, 0], [4, 0], [6, 0], [7, 0], [8, 0],
  [0, 1], [2, 1], [3, 1], [6, 1], [8, 1],
  [0, 2], [1, 2], [2, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2],
  [3, 3], [5, 3], [1, 4], [2, 4], [4, 4], [7, 4],
  [0, 6], [1, 6], [2, 6], [5, 6], [7, 6],
  [0, 7], [2, 7], [4, 7], [6, 7], [8, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [5, 8], [8, 8],
];

const COPY = {
  qr: { label: "시범 동작: 폰 카메라로 QR을 읽으면 촬영 화면이 열립니다", steps: ["폰 카메라로 QR 읽기", "촬영 화면 열림"] },
  place: { label: "시범 동작: 노트북을 부스 바닥의 표시 위치에 맞춰 올립니다", steps: ["노트북을 부스에", "표시 칸에 맞춰 놓기"] },
} as const;

/**
 * QR·촬영 안내의 짧은 시범 동작(11/8, 약 2.5초 한 번).
 * qr: 폰 화면에 QR이 들어오고 스캔 선이 지나간 뒤 확인 표시. place: 노트북이 옆에서 들어와 점선 칸에 맞으면 칸이 실선이 된다.
 * 그림은 같은 노트북 모양(LaptopShape)을 작게 줄여 쓴다
 */
export function PlaceDemo({ variant, className }: { variant: keyof typeof COPY; className?: string }) {
  const play = usePlayback<HTMLElement>();
  const copy = COPY[variant];
  return (
    <figure ref={play.ref} {...play.attrs} className={cn("m-scene m-place m-tone-light m-0 grid gap-2 rounded-xl border bg-muted/40 p-3", className)}>
      <svg key={play.runKey} viewBox={variant === "qr" ? "0 0 320 150" : "0 0 320 126"} className="block h-auto w-full max-w-[22rem]" role="img" aria-label={copy.label}>
        {variant === "qr" ? (
          <g>
            <g className="m-place-phone">
              <rect x={118} y={6} width={84} height={138} rx={14} fill="var(--card)" stroke="var(--m-lid-stroke)" strokeWidth={1.5} />
              <rect x={128} y={22} width={64} height={100} rx={6} fill="var(--m-logo)" />
              <g className="m-place-qr" transform="translate(133 45)">
                {QR_CELLS.map(([x, y]) => (
                  <rect key={`${x}-${y}`} x={x * 6} y={y * 6} width={5.4} height={5.4} rx={0.8} fill="var(--foreground)" />
                ))}
              </g>
              <rect className="m-place-scan" x={130} y={40} width={60} height={2} rx={1} />
              <g className="m-place-ok">
                <circle cx={160} cy={72} r={15} fill="var(--success)" />
                <path d="M153 72l5 5 9-10" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          </g>
        ) : (
          <g>
            {/* 부스 바닥의 표시 칸 */}
            <rect className="m-place-slot" x={86} y={12} width={148} height={102} rx={10} />
            {/* CSS 움직임(transform)이 크기 맞춤(transform 속성)을 덮지 않게 두 겹으로 둔다 */}
            <g className="m-place-laptop">
              <g transform="translate(90 16) scale(0.4375 0.4524)">
                <LaptopShape />
              </g>
            </g>
          </g>
        )}
      </svg>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-foreground">시범</span>
          {copy.steps[0]} → {copy.steps[1]}
        </span>
        <button type="button" className="m-replay" onClick={play.replay}>
          <RotateCcw aria-hidden="true" className="size-3.5" />
          다시 보기
        </button>
      </figcaption>
    </figure>
  );
}

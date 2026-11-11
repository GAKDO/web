import type { CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LaptopSvg, LID } from "./LaptopFigure";
import { usePlayback } from "./usePlayback";

/** 스캔 선이 지나가는 위·아래 끝(그림 좌표) */
const SCAN_FROM = LID.y + 8;
const SCAN_TO = LID.y + LID.height - 8;
/** 스캔 선이 위에서 아래까지 가는 시간(초)과 시작 지연. 한 차례 전체는 약 4초 */
const SCAN_S = 3.2;
const SCAN_DELAY_S = 0.2;

/** 설명용 흠집 후보 자리(그림 좌표, 실제 검사 데이터가 아님) */
const MARKS = [
  { x: 88, y: 66 },
  { x: 214, y: 114 },
  { x: 146, y: 156 },
];

/** 스캔 선이 그 높이에 닿는 시각(초). 선은 거의 고른 속도라 위치 비율로 계산한다 */
function reachAt(y: number): number {
  return SCAN_DELAY_S + ((y - SCAN_FROM) / (SCAN_TO - SCAN_FROM)) * SCAN_S;
}

interface Props {
  className?: string;
  /** 어두운 바탕(홈 첫 칸·로그인)인지 */
  tone?: "dark" | "light";
  /** 아래 꼬리표(단계 문장·설명용 표시·다시 보기)를 보일지. 로그인 화면처럼 좁은 곳에서는 끈다 */
  caption?: boolean;
}

/**
 * ① 홈 — 흠집 탐지(11/8 trace-motion-preview 기준). 빨간 스캔 선이 노트북 위에서 아래로 한 번 지나가고,
 * 선이 지나간 자리에 흠집 후보 표시가 차례로 나타난다(약 4초, 화면에 들어올 때 한 번).
 * 실제 검사 결과로 오해하지 않게 "설명용 그림" 표시를 붙이고, 후보는 직원이 확인한다는 흐름을 꼬리표로 적는다
 */
export function ScanMotion({ className, tone = "dark", caption = true }: Props) {
  const play = usePlayback<HTMLElement>();
  return (
    <figure
      ref={play.ref}
      {...play.attrs}
      className={cn("m-scene m-scan m-0", tone === "dark" ? "m-tone-dark" : "m-tone-light", className)}
      style={{ "--m-scan-from": `${SCAN_FROM}px`, "--m-scan-to": `${SCAN_TO}px`, "--m-scan-s": `${SCAN_S}s`, "--m-scan-delay": `${SCAN_DELAY_S}s` } as CSSProperties}
    >
      <LaptopSvg className={caption ? "block h-auto w-full" : "block size-full"} grid label="설명용 그림: 노트북 위로 스캔 선이 지나가며 흠집 후보가 차례로 표시됩니다">
        <g key={play.runKey}>
          {MARKS.map((m) => (
            <g key={m.x} className="m-mark" style={{ animationDelay: `${reachAt(m.y).toFixed(2)}s` }}>
              <circle cx={m.x} cy={m.y} r={11} />
              <circle cx={m.x} cy={m.y} r={2.5} className="m-mark-core" />
            </g>
          ))}
          <g className="m-scanner">
            <rect x={LID.x + 6} y={-14} width={LID.width - 12} height={14} className="m-scanner-glow" />
            <rect x={LID.x + 6} y={-1.25} width={LID.width - 12} height={2.5} rx={1.25} className="m-scanner-line" />
          </g>
        </g>
      </LaptopSvg>
      {caption && (
        <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <span key={play.runKey} className="m-scan-status inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
            스캔 → 흠집 후보 → 직원 확인
          </span>
          <span className="inline-flex items-center gap-3">
            <span className="m-sample">설명용 그림</span>
            <button type="button" className="m-replay" onClick={play.replay}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              다시 보기
            </button>
          </span>
        </figcaption>
      )}
    </figure>
  );
}

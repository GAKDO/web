import { useId, type ReactNode } from "react";

/** 노트북 그림 좌표계. 위에서 본 덮개(윗면) 하나. 스캔 선·흠집 표시는 이 좌표로 그린다 */
export const LAPTOP_VIEWBOX = { width: 320, height: 210 } as const;
/** 덮개 안쪽(스캔 선이 지나가는 범위) */
export const LID = { x: 8, y: 6, width: 304, height: 192 } as const;

/**
 * 위에서 본 노트북 덮개(SVG <g>). 홈 흠집 탐지·부스 위치 안내 등 설명용 그림이 같은 모양을 쓴다(11/8).
 * 색은 motion.css의 --m-lid-* 변수라 어두운 바탕(m-tone-dark)·밝은 바탕(m-tone-light)에서 각각 잘 보인다.
 * grid: 부스 카메라 2대 × 조명 3개 = 사진 6칸을 점선으로
 */
export function LaptopShape({ grid = false, children }: { grid?: boolean; children?: ReactNode }) {
  const gradient = `m-lid-${useId().replace(/:/g, "")}`;
  return (
    <g className="m-laptop">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--m-lid-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--m-lid-to)" }} />
        </linearGradient>
      </defs>
      <rect x={LID.x} y={LID.y} width={LID.width} height={LID.height} rx={18} fill={`url(#${gradient})`} stroke="var(--m-lid-stroke)" strokeWidth={1.2} />
      <circle cx={160} cy={102} r={15} fill="var(--m-logo)" stroke="var(--m-lid-stroke)" strokeWidth={1} />
      <rect x={118} y={195} width={84} height={6} rx={3} fill="var(--m-hinge)" />
      {grid &&
        Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={30 + (i % 3) * 88}
            y={24 + Math.floor(i / 3) * 80}
            width={80}
            height={72}
            rx={8}
            fill="none"
            stroke="var(--m-grid)"
            strokeDasharray="4 4"
          />
        ))}
      {children}
    </g>
  );
}

/** 노트북 그림을 담는 SVG. 크기는 바깥 칸에 맞추고(meet) 그림 비율은 그대로 둔다 */
export function LaptopSvg({ label, className, children, grid }: { label?: string; className?: string; children?: ReactNode; grid?: boolean }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LAPTOP_VIEWBOX.width} ${LAPTOP_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid meet"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <LaptopShape grid={grid}>{children}</LaptopShape>
    </svg>
  );
}

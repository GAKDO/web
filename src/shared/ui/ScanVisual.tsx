import { cn } from "@/lib/utils";

/** 흠집 표시 위치(노트북 그림 안 %, 장식용. 실제 검사 데이터가 아님) */
const MARKS = [
  { left: "28%", top: "34%", delay: "0.3s" },
  { left: "66%", top: "58%", delay: "1.1s" },
  { left: "44%", top: "74%", delay: "1.6s" },
];

/**
 * 서비스 소개 그림: 위에서 본 노트북 위를 빨간 검사 막대가 훑고, 지나간 자리에 흠집 표시가 떴다 사라진다.
 * 부스가 사진을 찍어 흠집을 찾는 흐름을 한눈에 보이는 장식이라 화면 읽기에서는 숨긴다.
 * 움직임 줄이기 설정이면 막대와 표시가 멈춘 채로 보인다
 */
export function ScanVisual({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative aspect-[4/3] w-full animate-float select-none", className)}>
      {/* 노트북 윗면: 둥근 판 + 로고 자리 + 경첩 */}
      <div className="absolute inset-x-0 inset-y-[6%] rounded-[18px] border border-white/15 bg-[linear-gradient(145deg,#2a2a31,#141418)] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]">
        <div className="absolute top-1/2 left-1/2 size-10 -translate-1/2 rounded-full border border-white/10 bg-white/[0.04]" />
        <div className="absolute inset-x-[30%] -bottom-px h-1.5 rounded-t-md bg-white/10" />
        {/* 사진 칸 표시(부스 카메라 2대 × 조명 3개 = 6칸) */}
        <div className="absolute inset-[8%] grid grid-cols-3 grid-rows-2 gap-1.5 opacity-40">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="rounded-md border border-dashed border-white/15" />
          ))}
        </div>
        {/* 검사 막대: 빨간 선 + 아래로 번지는 빛 */}
        <div className="absolute inset-x-[3%] h-0.5 animate-scan rounded-full bg-brand shadow-[0_0_16px_2px_var(--brand),0_14px_40px_8px_rgb(200_22_29/0.25)]" />
        {MARKS.map((m) => (
          <span key={m.left} className="absolute -translate-1/2" style={{ left: m.left, top: m.top }}>
            <span className="block size-6 animate-ping-soft rounded-full border-2 border-brand bg-brand/20" style={{ animationDelay: m.delay }} />
          </span>
        ))}
      </div>
      {/* 결과 꼬리표 */}
      <div className="absolute right-0 bottom-[2%] flex animate-enter items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur [animation-delay:400ms]">
        <span className="size-2 animate-pulse rounded-full bg-brand" />
        흠집을 찾는 중
      </div>
    </div>
  );
}

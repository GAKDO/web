import { cn } from "@/lib/utils";

/**
 * TRACE 글자 로고(흰색, 궤도·별 포함). 어두운 바탕 위에만 쓴다.
 * 원본 PNG를 벡터로 딴 public/trace-logo.svg를 보여 준다(가로:세로 약 2.55:1).
 */
export function TraceLogo({ className }: { className?: string }) {
  return (
    <img
      src="/trace-logo.svg"
      alt="TRACE"
      width={1904}
      height={746}
      draggable={false}
      className={cn("block h-10 w-auto select-none", className)}
    />
  );
}

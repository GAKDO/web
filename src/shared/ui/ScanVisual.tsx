import { cn } from "@/lib/utils";
import { ScanMotion } from "../motion/ScanMotion";

/**
 * 로그인 화면 왼쪽 장식 그림. 홈의 흠집 탐지 모션(ScanMotion)과 같은 노트북·스캔 선을 쓰고(11/8),
 * 좁은 칸이라 아래 꼬리표는 뺀다. 그림 자체는 "설명용 그림"으로 화면 읽기에 이름이 붙는다
 */
export function ScanVisual({ className }: { className?: string }) {
  return <ScanMotion caption={false} className={cn("aspect-[320/210] w-full select-none", className)} />;
}

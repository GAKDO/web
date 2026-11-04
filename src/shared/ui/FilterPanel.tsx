import { useCallback, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet } from "./Sheet";
import { useIsMobile } from "./useMediaQuery";

interface FilterPanelProps {
  /** 거르는 칸들(기종·상태 등) */
  children: ReactNode;
  /** 지금 걸린 조건 수. 폰의 필터 버튼에 숫자로 보인다 */
  active: number;
  /** 폰에서도 패널 밖에 그대로 두는 칸(검색처럼 자주 쓰는 것) */
  inline?: ReactNode;
  /** 768px 이상 한 줄 배치(grid-template-columns) */
  cols?: string;
  onReset?: () => void;
}

/**
 * 목록 위 거르기. 768px 이상은 한 줄에 칸을 늘어놓고,
 * 폰은 칸을 옆 패널에 넣어 목록이 첫 화면에 바로 보이게 한다(칸 3개면 세로 250px을 아낌)
 */
export function FilterPanel({ children, active, inline, cols, onReset }: FilterPanelProps) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!mobile) {
    return (
      <div className={cn("grid gap-x-3", !cols && "md:grid-cols-[minmax(0,320px)]")} style={cols ? { gridTemplateColumns: cols } : undefined}>
        {children}
        {inline}
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-end gap-2">
      <div className="min-w-0 flex-1 [&>*]:mb-0">{inline}</div>
      <Button type="button" variant="outline" className={cn(!inline && "w-full", active > 0 && "border-brand text-brand")} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal aria-hidden="true" />
        필터{active > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{active}</span>}
      </Button>
      {open && (
        <Sheet
          title="필터"
          onClose={close}
          footer={
            <div className="flex gap-2">
              {onReset && (
                <Button type="button" variant="outline" className="flex-1" onClick={onReset} disabled={active === 0}>
                  초기화
                </Button>
              )}
              <Button type="button" className="flex-1" onClick={close}>
                결과 보기
              </Button>
            </div>
          }
        >
          {children}
        </Sheet>
      )}
    </div>
  );
}

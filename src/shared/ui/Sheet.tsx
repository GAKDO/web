import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 아래쪽 고정 버튼 줄 */
  footer?: ReactNode;
}

/**
 * 폰에서 오른쪽에서 밀려 나오는 패널(필터 등). 뒤 화면은 어둡게 하고 스크롤을 멈춘다.
 * Esc·바깥 누르기·닫기 버튼으로 닫고, 닫으면 연 버튼으로 초점이 돌아간다
 */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Tab·Shift+Tab이 패널 안에서만 돈다(뒤 화면으로 초점이 빠지지 않게)
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = body;
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] animate-sheet-right flex-col bg-card shadow-2xl"
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label={`${title} 닫기`} onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

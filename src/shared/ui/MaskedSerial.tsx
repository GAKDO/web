import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { maskSerial } from "./maskSerial";

/**
 * 시리얼을 가려 두었다가 눈 버튼을 누르면 전체를 보여 준다(비밀번호 칸처럼, 11/6 민서 요청).
 * 화면을 옮기면 다시 가려진다. 상세·고치기 화면에서 쓴다.
 */
export function MaskedSerial({ serial, className }: { serial: string; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <span className="min-w-0 break-all font-mono tabular-nums" aria-live="polite">
        {shown ? serial : maskSerial(serial)}
      </span>
      <button
        type="button"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={shown ? "시리얼 가리기" : "시리얼 보기"}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  );
}

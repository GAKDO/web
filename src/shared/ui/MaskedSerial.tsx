import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { maskSerial } from "./maskSerial";

/**
 * 시리얼을 뒤 4자리만 보이게 가려 두고, 눈 아이콘을 누르면 전체를 보인다(비밀번호 칸처럼, 11/6 민서 요청).
 * 상세 화면에서 시연 화면·어깨너머 노출을 막으려는 것. 다시 누르면 가린다.
 */
export function MaskedSerial({ serial }: { serial: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums">{shown ? serial : maskSerial(serial)}</span>
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={shown ? "시리얼 가리기" : "시리얼 보기"}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * 등록·수정 성공 알림. 화면을 옮길 때 navigate(..., { state: { notice } })로 넘긴 문장을 잠깐 보여 준다.
 * 서버가 저장에 성공한(응답을 받은) 뒤에만 넘기므로 "저장됨"이 실제와 어긋나지 않는다
 */
export function FlashNotice({ ms = 4000 }: { ms?: number }) {
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (typeof notice !== "string") return;
    setShown(notice);
    const timer = setTimeout(() => setShown(null), ms);
    return () => clearTimeout(timer);
  }, [location.key, notice, ms]);

  if (!shown) return null;
  return (
    <div className="toast" role="status">
      <span>✔ {shown}</span>
      <button type="button" aria-label="알림 닫기" onClick={() => setShown(null)}>
        ×
      </button>
    </div>
  );
}

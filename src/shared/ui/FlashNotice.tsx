import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleCheck, X } from "lucide-react";

/**
 * 등록·수정 성공 알림. 화면을 옮길 때 navigate(..., { state: { notice } })로 넘긴 문장을 잠깐 보여 준다.
 * 서버가 저장에 성공한(응답을 받은) 뒤에만 넘기므로 "저장됨"이 실제와 어긋나지 않는다.
 * 보여 준 뒤에는 기록에서 notice만 지워(serial 같은 다른 state는 둔다) 새로고침·뒤로 가기로 다시 뜨지 않게 하고,
 * 다른 화면으로 옮기면 바로 닫는다
 */
export function FlashNotice({ ms = 4000 }: { ms?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // notice를 지우려고 replace한 이동은 "다른 화면으로 옮김"이 아니므로 한 번 건너뛴다
  const consuming = useRef(false);

  useEffect(() => {
    if (consuming.current) {
      consuming.current = false;
      return;
    }
    clearTimeout(timer.current);
    const state = location.state as Record<string, unknown> | null;
    const notice = state?.notice;
    if (typeof notice !== "string") {
      setShown(null);
      return;
    }
    setShown(notice);
    timer.current = setTimeout(() => setShown(null), ms);
    const { notice: _consumed, ...rest } = state ?? {};
    consuming.current = true;
    navigate(location.pathname + location.search + location.hash, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
    // location.key가 바뀔 때만 다시 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!shown) return null;
  return (
    <div
      className="fixed right-4 bottom-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-success/30 bg-card py-2 pr-2 pl-4 text-sm font-semibold text-success shadow-lg"
      role="status"
    >
      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
      <span>{shown}</span>
      <button
        type="button"
        aria-label="알림 닫기"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        onClick={() => setShown(null)}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * 숫자가 처음 보이거나 바뀔 때 앞 값에서 새 값까지 짧게 세어 올라간다(11/11, 5팀 홈 숫자 효과에서 아이디어).
 * 움직임 줄이기 설정·requestAnimationFrame이 없는 곳(테스트)에서는 바로 새 값이다.
 * 화면 읽기 프로그램용 문장에는 이 값이 아니라 목표 값을 쓴다
 */
function instant(): boolean {
  return (
    typeof window === "undefined" ||
    typeof requestAnimationFrame !== "function" ||
    (typeof window.matchMedia === "function" && window.matchMedia(REDUCED).matches)
  );
}

export function useCountUp(target: number, ms = 600): number {
  // 처음 그릴 때부터 0에서 시작해야 목표 값이 한 번 보였다가 0으로 튀지 않는다
  const [shown, setShown] = useState(() => (instant() ? target : 0));
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    if (instant() || from === target) {
      current.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // 끝으로 갈수록 느려지게(ease-out)
      const value = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}

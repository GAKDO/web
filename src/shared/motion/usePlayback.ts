import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

function canObserve(): boolean {
  return typeof window !== "undefined" && typeof IntersectionObserver !== "undefined";
}

/** 움직임 줄이기 설정인지. 그때는 처음부터 최종 상태를 보인다(motion.css에서 애니메이션을 끔) */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED).matches;
}

export interface Playback<T extends Element> {
  ref: RefObject<T>;
  /** 한 번이라도 화면에 들어와 재생을 시작했는지 */
  started: boolean;
  /** 재생 중인데 화면 밖이거나 탭이 숨었다 → 애니메이션을 멈춰 둔다 */
  paused: boolean;
  /** 다시 재생할 때 바뀌는 값. 움직이는 부분의 key로 쓰면 처음부터 다시 돈다 */
  runKey: number;
  replay: () => void;
  /** 장면 바깥 요소에 그대로 펼쳐 넣는 속성(motion.css가 읽음) */
  attrs: { "data-motion": "idle" | "play"; "data-paused": "true" | undefined };
}

/**
 * 설명용 모션 한 장면의 재생 상태(11/8). 화면에 들어올 때 한 번 재생하고,
 * 재생 중 화면 밖으로 나가거나 브라우저 탭이 비활성화되면 멈췄다가 돌아오면 이어서 돈다.
 * IntersectionObserver가 없는 곳(테스트 jsdom)이나 움직임 줄이기 설정이면 처음부터 재생 상태(=CSS가 최종 상태를 보임)다
 */
export function usePlayback<T extends Element>(rootMargin = "0px 0px -10% 0px"): Playback<T> {
  const ref = useRef<T>(null);
  const [started, setStarted] = useState(() => !canObserve() || prefersReducedMotion());
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canObserve()) return;
    const io = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((e) => e.isIntersecting);
        setVisible(inView);
        if (inView) setStarted(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const replay = useCallback(() => {
    setStarted(true);
    setRunKey((n) => n + 1);
  }, []);

  const paused = started && (!visible || hidden);
  return {
    ref,
    started,
    paused,
    runKey,
    replay,
    attrs: { "data-motion": started ? "play" : "idle", "data-paused": paused ? "true" : undefined },
  };
}

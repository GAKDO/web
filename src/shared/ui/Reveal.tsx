import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * 요소가 화면에 들어왔는지(한 번 들어오면 계속 true).
 * IntersectionObserver가 없는 곳(테스트 jsdom·옛 브라우저)이나 움직임 줄이기 설정이면 처음부터 true라 내용이 숨지 않는다
 */
export function useInView<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(
    () =>
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined" ||
      (typeof window.matchMedia === "function" && window.matchMedia(REDUCED).matches),
  );
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen] as const;
}

interface RevealProps {
  as?: ElementType;
  /** 같은 묶음 안 순번. 90ms씩 늦게 나타난다 */
  index?: number;
  className?: string;
  children: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
}

/**
 * 스크롤해서 화면에 들어올 때 아래에서 떠오르며 나타나는 칸(11/8, 애플 소개 화면처럼).
 * 처음 한 번만 움직이고, 움직임 줄이기 설정이면 처음부터 제자리에 보인다(index.css .reveal)
 */
export function Reveal({ as: Tag = "div", index = 0, className, children, ...rest }: RevealProps) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} data-visible={seen} className={cn("reveal", className)} style={{ "--i": index } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

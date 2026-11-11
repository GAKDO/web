import { cn } from "@/lib/utils";

interface Props {
  /** 화면 읽기 프로그램이 읽을 문장(보이지는 않는다) */
  label?: string;
  /** 회색 자리 개수 */
  count?: number;
  /** rows = 목록 줄, cards = 카드 격자(공개 노트북 목록), detail = 상세 화면(제목 + 칸 몇 개) */
  variant?: "rows" | "cards" | "detail";
  className?: string;
}

/**
 * 불러오는 동안 보이는 회색 자리(11/11, 5팀·1팀의 스켈레톤에서 아이디어). 글자만 있던 "불러오는 중…"보다
 * 결과가 어디에 어떤 모양으로 나올지 먼저 보여 줘 화면이 덜 튄다. 반짝임은 움직임 줄이기 설정이면 멈춘다
 */
export function LoadingRows({ label = "불러오는 중…", count = 4, variant = "rows", className }: Props) {
  if (variant === "detail") {
    return (
      <div role="status" className={cn("grid gap-4", className)}>
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="grid gap-2">
          <span className="skeleton block h-7 w-1/2 max-w-xs rounded" />
          <span className="skeleton block h-4 w-2/3 max-w-md rounded" />
        </div>
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: Math.min(count, 4) }, (_, i) => (
            <div key={i} className="grid gap-2 rounded-xl border bg-card p-4" style={{ opacity: 1 - i * 0.15 }}>
              <span className="skeleton block h-4 w-1/3 rounded" />
              <span className="skeleton block h-3 w-full rounded" />
              <span className="skeleton block h-3 w-4/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <ul
        aria-hidden="true"
        className={cn("m-0 grid list-none gap-2 p-0", variant === "cards" && "gap-4 sm:grid-cols-2 lg:grid-cols-3")}
      >
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className={cn("rounded-xl border bg-card p-4", variant === "cards" ? "grid gap-3" : "flex items-center gap-4")}
            style={{ opacity: 1 - i * 0.15 }}
          >
            {variant === "cards" ? (
              <>
                <span className="skeleton block aspect-[4/3] w-full rounded-lg" />
                <span className="skeleton block h-4 w-2/3 rounded" />
                <span className="skeleton block h-3 w-1/2 rounded" />
              </>
            ) : (
              <>
                <span className="skeleton block h-4 w-1/3 rounded" />
                <span className="skeleton block h-3 flex-1 rounded" />
                <span className="skeleton hidden h-8 w-20 rounded-md sm:block" />
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

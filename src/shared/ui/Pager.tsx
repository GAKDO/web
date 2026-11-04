import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** useInfiniteQuery 결과 중 쪽 넘김에 쓰는 것만 */
interface InfiniteLike<T> {
  data?: { pages: { items: T[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * 커서 목록(계약: nextCursor만 있고 전체 건수는 없음)을 한 쪽씩 보이게 한다.
 * 이어 붙이던 "더 보기"는 폰에서 스크롤이 끝없이 길어져, 지금 쪽만 그리고 이전·다음으로 넘긴다.
 * 이미 읽은 쪽은 번호로 바로 가고, 마지막으로 읽은 쪽에서 다음을 누르면 그때 다음 쪽을 읽는다.
 * resetKey(거르기 조건)가 바뀌면 1쪽으로 돌아간다. 지금 쪽은 주소 ?page=N에 남는다
 */
export function usePaged<T>(query: InfiniteLike<T>, resetKey = "") {
  // 지금 쪽은 주소(?page=2)에 둔다. 상세를 열었다가 목록으로 돌아와도(뒤로 가기·목록 링크) 그 쪽이 그대로 보인다
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, (Number(params.get("page")) || 1) - 1);
  const setPage = useCallback(
    (to: number) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (to > 0) next.set("page", String(to + 1));
          else next.delete("page");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  // 거르기 조건이 바뀌면 1쪽으로(처음 열 때는 주소의 쪽을 지킨다)
  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    setPage(0);
  }, [resetKey, setPage]);
  const pages = query.data?.pages ?? [];
  const loaded = pages.length;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  // 주소의 쪽까지 아직 읽지 않았으면(새로 열었거나 캐시가 비었으면) 그 쪽까지 차례로 읽는다
  useEffect(() => {
    if (loaded > 0 && page >= loaded && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [loaded, page, hasNextPage, isFetchingNextPage, fetchNextPage]);
  const current = Math.min(page, Math.max(loaded - 1, 0));
  const go = async (to: number) => {
    if (to >= loaded) {
      if (!hasNextPage) return;
      await fetchNextPage();
    }
    setPage(to);
  };
  return {
    items: pages[current]?.items ?? [],
    page: current,
    loaded,
    canPrev: current > 0,
    canNext: current < loaded - 1 || hasNextPage,
    busy: isFetchingNextPage,
    go,
  };
}

type Paged = ReturnType<typeof usePaged>;

/** 목록 아래 쪽 넘김: ‹ 이전 · 1 2 3 · 다음 › (전체 쪽 수는 계약에 없어 읽은 쪽까지만 번호를 단다) */
export function Pager({ paged, label }: { paged: Paged; label: string }) {
  const top = useRef<HTMLElement>(null);
  if (paged.loaded <= 1 && !paged.canNext) return null;
  const go = (to: number) => {
    void paged.go(to).then(() => {
      // 넘긴 뒤 목록 첫 줄이 보이게(움직임 줄이기 설정이면 바로)
      const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const list = top.current?.parentElement;
      if (list && typeof list.scrollIntoView === "function") list.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    });
  };
  return (
    <nav ref={top} aria-label={`${label} 쪽 넘김`} className="mt-2 flex items-center justify-between gap-2 md:justify-center">
      <Button type="button" variant="outline" disabled={!paged.canPrev} onClick={() => go(paged.page - 1)}>
        <ChevronLeft aria-hidden="true" />
        이전 쪽
      </Button>
      <ol className="m-0 flex list-none items-center gap-1 overflow-hidden p-0">
        {Array.from({ length: paged.loaded }, (_, i) => i)
          // 폰에서 번호가 넘치지 않게 지금 쪽 앞뒤 1쪽과 첫 쪽만
          .filter((i) => i === 0 || Math.abs(i - paged.page) <= 1)
          .map((i) => (
            <li key={i}>
              <Button
                type="button"
                variant={i === paged.page ? "default" : "ghost"}
                size="icon"
                aria-label={`${i + 1}쪽`}
                aria-current={i === paged.page ? "page" : undefined}
                className={cn("text-sm tabular-nums", i !== paged.page && "text-muted-foreground")}
                onClick={() => go(i)}
              >
                {i + 1}
              </Button>
            </li>
          ))}
      </ol>
      <Button type="button" variant="outline" disabled={!paged.canNext || paged.busy} onClick={() => go(paged.page + 1)}>
        {paged.busy ? "불러오는 중…" : "다음 쪽"}
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

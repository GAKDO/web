/** 커서 목록(useInfiniteQuery) 중 첫 쪽의 전체 건수만 쓴다 */
interface WithTotal {
  data?: { pages: { totalCount?: number }[] };
}

/** 첫 쪽 응답의 totalCount(같은 거르기 조건의 전체 건수, contracts #23). 옛 서버라 값이 없으면 undefined */
export function totalOf(query: WithTotal): number | undefined {
  const total = query.data?.pages[0]?.totalCount;
  return typeof total === "number" ? total : undefined;
}

/** 목록 위 "총 N건". 서버가 건수를 주지 않으면 그리지 않는다 */
export function TotalCount({ query, label = "총" }: { query: WithTotal; label?: string }) {
  const total = totalOf(query);
  if (total === undefined) return null;
  return (
    <p className="mt-0 mb-2 text-sm text-muted-foreground" aria-live="polite">
      {label} <strong className="font-semibold text-foreground tabular-nums">{total.toLocaleString("ko-KR")}</strong>건
    </p>
  );
}

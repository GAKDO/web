import { useQueries } from "@tanstack/react-query";
import { CircleCheck, CircleX, Hourglass, ListChecks, type LucideIcon } from "lucide-react";
import type { RentalSummary } from "../../../shared/api/types";
import { cn } from "@/lib/utils";
import { inspectionQuery } from "../api/inspections";
import { verdictOf } from "../model/verdict";

interface Tile {
  label: string;
  count: number;
  icon: LucideIcon;
  tone: string;
}

/**
 * 검사 결과 맨 위 요약 카드. 판정별 칸은 지금 보고 있는 쪽만 센다(판정은 시점마다 capture-server에 묻기 때문).
 * 전체 건수(total, contracts #23)가 오면 함께 적고, "이 쪽 N건 기준"과 다음 쪽 여부도 알린다.
 * 줄마다 쓰는 검사 결과와 같은 키라 따로 더 읽지 않는다
 */
export function VerdictSummary({ items, hasMore, total }: { items: RentalSummary[]; hasMore: boolean; total?: number }) {
  const results = useQueries({ queries: items.map((r) => inspectionQuery(r.currentCheckpoint?.checkpointId)) });
  let ok = 0;
  let bad = 0;
  let waiting = 0;
  items.forEach((r, i) => {
    const checkpoint = r.currentCheckpoint ?? null;
    const q = results[i];
    if (!checkpoint || q.isError) return;
    const kind = verdictOf(checkpoint, q.isPending ? "loading" : (q.data ?? null)).kind;
    if (kind === "ok") ok += 1;
    else if (kind === "bad") bad += 1;
    else if (kind === "pending") waiting += 1;
  });
  const other = items.length - ok - bad - waiting;
  const tiles: Tile[] = [
    { label: "검사 대상", count: items.length, icon: ListChecks, tone: "text-foreground bg-muted" },
    { label: "문제 없음", count: ok, icon: CircleCheck, tone: "text-success bg-success-soft" },
    { label: "문제 있음", count: bad, icon: CircleX, tone: "text-destructive bg-destructive-soft" },
    { label: "판정 대기", count: waiting, icon: Hourglass, tone: "text-warning bg-warning-soft" },
  ];
  return (
    <section aria-label="판정 요약" className="mb-6">
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 md:gap-3">
        {tiles.map(({ label, count, icon: Icon, tone }) => (
          <li key={label} className="flex animate-enter flex-col items-start gap-1 rounded-xl border bg-card px-3 py-2.5 shadow-xs md:flex-row md:items-center md:gap-3 md:p-4">
            <span aria-hidden="true" className={cn("hidden size-10 shrink-0 place-items-center rounded-lg md:grid", tone)}>
              <Icon className="size-5" />
            </span>
            <span className="grid min-w-0">
              <span className="text-[0.6875rem] whitespace-nowrap text-muted-foreground md:text-[0.8125rem]">{label}</span>
              <strong className={cn("text-xl leading-tight font-bold tracking-tight md:text-2xl md:text-foreground", tone.split(" ")[0])}>{count}</strong>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 mb-0 text-xs text-muted-foreground">
        {total !== undefined && total > items.length ? `전체 ${total.toLocaleString("ko-KR")}건 중 ` : ""}이 쪽 {items.length}건 기준
        {other > 0 ? ` · 검사 전·판정 불가·읽지 못함 ${other}건은 위 칸에 넣지 않았습니다` : ""}
        {hasMore ? " · 다음 쪽이 더 있습니다" : ""}
      </p>
    </section>
  );
}

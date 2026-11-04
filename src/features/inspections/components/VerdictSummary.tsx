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
 * 검사 결과 맨 위 요약 카드. 지금 불러온 목록(더 보기로 늘어남)만 센다.
 * 전체 건수는 계약에 아직 없어서(contracts#23) "불러온 N건 기준"이라고 함께 적고, 더 있으면 그것도 알린다.
 * 줄마다 쓰는 검사 결과와 같은 키라 따로 더 읽지 않는다
 */
export function VerdictSummary({ items, hasMore }: { items: RentalSummary[]; hasMore: boolean }) {
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
  const tiles: Tile[] = [
    { label: "검사 대상", count: items.length, icon: ListChecks, tone: "text-foreground bg-muted" },
    { label: "문제 없음", count: ok, icon: CircleCheck, tone: "text-success bg-success-soft" },
    { label: "문제 있음", count: bad, icon: CircleX, tone: "text-destructive bg-destructive-soft" },
    { label: "판정 대기", count: waiting, icon: Hourglass, tone: "text-warning bg-warning-soft" },
  ];
  return (
    <section aria-label="판정 요약" className="mb-6">
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
        {tiles.map(({ label, count, icon: Icon, tone }) => (
          <li key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tone)}>
              <Icon className="size-5" />
            </span>
            <span className="grid min-w-0">
              <span className="text-[13px] text-muted-foreground">{label}</span>
              <strong className="text-2xl leading-tight font-bold tracking-tight">{count}</strong>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 mb-0 text-xs text-muted-foreground">
        지금 불러온 {items.length}건 기준{hasMore ? " · 목록이 더 있습니다(아래 더 보기)" : ""}
      </p>
    </section>
  );
}

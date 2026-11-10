import type { RentalSummary } from "../../shared/api/types";

/** 오늘 날짜(한국 시간, YYYY-MM-DD). 반납 예정일(dueAt)이 날짜만 오므로 같은 모양으로 비교한다 */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 반납 예정일 표시(contracts #23, 11/10). 값이 없으면 null.
 * 진행 중(OPEN)인데 오늘(한국 시간)보다 앞이면 지남. 반납·종료된 렌탈은 지남으로 보지 않는다
 */
export function dueState(rental: Pick<RentalSummary, "dueAt" | "status">, now: Date = new Date()): { label: string; overdue: boolean } | null {
  if (!rental.dueAt) return null;
  const [y, m, d] = rental.dueAt.split("-");
  if (!y || !m || !d) return null;
  return { label: `${y}. ${Number(m)}. ${Number(d)}.`, overdue: rental.status === "OPEN" && rental.dueAt < todayKst(now) };
}

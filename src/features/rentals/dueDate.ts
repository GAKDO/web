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

/**
 * 반납 예정일 입력 검사(11/13). 오늘(한국 시간)보다 과거면 오류 문장, 아니면 null.
 * 빈 값과 이미 저장된 값(original) 그대로는 통과한다(기존 데이터 보존, 서버 규칙과 같음)
 */
export function dueInputError(value: string, original: string | null = null, now: Date = new Date()): string | null {
  if (!value || value === original) return null;
  const today = todayKst(now);
  if (value >= today) return null;
  const [y, m, d] = today.split("-");
  return `반납 예정일은 오늘(${y}. ${Number(m)}. ${Number(d)}.) 이후로 정해 주세요.`;
}

/** 반납 예정일 칸 아래 안내 */
export const DUE_HINT = "오늘 이후 날짜만 고를 수 있습니다.";

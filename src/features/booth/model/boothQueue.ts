import type { RentalSummary } from "../../../shared/api/types";

/**
 * 부스 화면의 두 목록. 부스(Jetson)의 "검사 기다리는 기기"와 같은 규칙을 쓴다(booth rentals.py):
 * - waiting: 진행 중 렌탈 중 지금 시점이 열려 있는(OPEN, 아직 안 찍은) 기기
 * - judged: 지금 시점을 이미 찍은 기기(판정 대기·판정 완료·봉인). 반납 뒤(RETURNED)도 보인다. 최근 시각 순
 */
export interface BoothQueue {
  waiting: RentalSummary[];
  judged: RentalSummary[];
}

export function boothQueue(items: RentalSummary[]): BoothQueue {
  const live = items.filter((r) => r.status !== "CLOSED" && r.currentCheckpoint);
  const waiting = live.filter((r) => r.status === "OPEN" && r.currentCheckpoint?.status === "OPEN");
  const judged = live
    .filter((r) => r.currentCheckpoint?.status !== "OPEN")
    .sort((a, b) => (b.currentCheckpoint?.occurredAt ?? "").localeCompare(a.currentCheckpoint?.occurredAt ?? ""));
  return { waiting, judged };
}

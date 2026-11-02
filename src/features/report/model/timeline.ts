import type { CheckpointType, Pin, TimelineCheckpoint } from "../../../shared/api/types";

// 시점 슬라이더 계산(FR-012·013). 화면은 계약의 isNew만 쓰고 직접 비교하지 않는다
export const CHECKPOINT_ORDER: CheckpointType[] = ["OUT", "RCV", "RET"];

/** 출고 → 수령 → 반납 순서로 정렬한 시점 */
export function orderedCheckpoints(checkpoints: TimelineCheckpoint[]): TimelineCheckpoint[] {
  return [...checkpoints].sort((a, b) => CHECKPOINT_ORDER.indexOf(a.type) - CHECKPOINT_ORDER.indexOf(b.type));
}

/** 슬라이더에 올릴 수 있는 시점 = 봉인된 시점 */
export function sliderCheckpoints(checkpoints: TimelineCheckpoint[]): TimelineCheckpoint[] {
  return orderedCheckpoints(checkpoints).filter((c) => c.status === "SEALED");
}

/** 봉인 전(검사 중) 시점이 있는지. 진행률 연결 여부를 정한다(FR-021) */
export function hasPendingCheckpoint(checkpoints: TimelineCheckpoint[]): boolean {
  return checkpoints.some((c) => c.status !== "SEALED");
}

export interface PinGroups {
  newPins: Pin[];
  existingPins: Pin[];
}

export function splitPins(checkpoint: TimelineCheckpoint | undefined): PinGroups {
  const pins = checkpoint?.pins ?? [];
  return { newPins: pins.filter((p) => p.isNew), existingPins: pins.filter((p) => !p.isNew) };
}

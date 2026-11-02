import type { CheckpointStatus, CheckpointType, Rental } from "../../shared/api/types";

export type NextAction =
  | { kind: "start"; type: CheckpointType }
  | { kind: "waitSeal"; status: CheckpointStatus }
  | { kind: "close" }
  | { kind: "closed" };

const ORDER: CheckpointType[] = ["OUT", "RCV", "RET"];

/** 렌탈에서 지금 누를 수 있는 동작 하나. 서버가 준 시점 상태로만 정한다(data-model.md, FR-022·023) */
export function nextAction(rental: Pick<Rental, "status" | "checkpoints">): NextAction {
  if (rental.status === "CLOSED") return { kind: "closed" };
  const started = rental.checkpoints.length;
  if (started < ORDER.length) return { kind: "start", type: ORDER[started] };
  const ret = rental.checkpoints[started - 1];
  return ret.status === "SEALED" ? { kind: "close" } : { kind: "waitSeal", status: ret.status };
}

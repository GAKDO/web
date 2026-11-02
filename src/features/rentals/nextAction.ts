import type { CheckpointStatus, CheckpointType, Rental } from "../../shared/api/types";

export type NextAction =
  | { kind: "start"; type: CheckpointType }
  | { kind: "waitSeal"; type: CheckpointType; status: CheckpointStatus }
  | { kind: "close" }
  | { kind: "closed" };

const ORDER: CheckpointType[] = ["OUT", "RCV", "RET"];

/**
 * 렌탈에서 지금 누를 수 있는 동작 하나. 서버가 준 시점 상태로만 정한다(data-model.md, FR-022·023).
 * 앞 시점이 봉인(SEALED)된 뒤에만 다음 시점·종료를 연다(11/02 C 결정, 서버 동작은 c1-questions 11로 A 확인 중).
 */
export function nextAction(rental: Pick<Rental, "status" | "checkpoints">): NextAction {
  if (rental.status === "CLOSED") return { kind: "closed" };
  const last = rental.checkpoints.at(-1);
  if (last && last.status !== "SEALED") return { kind: "waitSeal", type: last.type, status: last.status };
  const started = rental.checkpoints.length;
  return started < ORDER.length ? { kind: "start", type: ORDER[started] } : { kind: "close" };
}

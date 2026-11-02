import type { Checkpoint, CheckpointStatus, CheckpointType, Rental } from "../../shared/api/types";
import { nextAction } from "./nextAction";

const cp = (type: CheckpointType, status: CheckpointStatus = "SEALED"): Checkpoint => ({ checkpointId: `id-${type}`, type, status, occurredAt: null });
const rental = (checkpoints: Checkpoint[], status: Rental["status"] = "OPEN") => ({ status, checkpoints });

test.each([
  ["시점이 없으면 출고 시작", rental([]), { kind: "start", type: "OUT" }],
  ["출고만 있으면 수령 시작", rental([cp("OUT", "OPEN")]), { kind: "start", type: "RCV" }],
  ["출고·수령이 있으면 반납 시작", rental([cp("OUT"), cp("RCV")]), { kind: "start", type: "RET" }],
  ["반납이 봉인 전(등급 매김)이면 봉인 대기", rental([cp("OUT"), cp("RCV"), cp("RET", "GRADED")], "RETURNED"), { kind: "waitSeal", status: "GRADED" }],
  ["반납이 봉인 전(촬영 대기)이면 봉인 대기", rental([cp("OUT"), cp("RCV"), cp("RET", "OPEN")], "RETURNED"), { kind: "waitSeal", status: "OPEN" }],
  ["반납이 봉인되면 렌탈 종료", rental([cp("OUT"), cp("RCV"), cp("RET")], "RETURNED"), { kind: "close" }],
  ["종료된 렌탈은 할 일이 없다", rental([cp("OUT"), cp("RCV"), cp("RET")], "CLOSED"), { kind: "closed" }],
])("%s", (_name, input, expected) => {
  expect(nextAction(input)).toEqual(expected);
});

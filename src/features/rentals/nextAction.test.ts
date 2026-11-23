// 이 파일이 확인하는 것: 렌탈 상세 화면이 관리자에게 "다음에 할 일"을 알려 주는 규칙.
// 렌탈은 출고(OUT) → 수령(RCV) → 반납(RET) 시점을 차례로 찍고 봉인(SEALED)한 뒤 종료한다.

import type { Checkpoint, CheckpointStatus, CheckpointType, Rental } from "../../shared/api/types";
import { nextAction } from "./nextAction";

// 테스트 도구: 시점 하나(종류·상태)를 만든다.
const cp = (type: CheckpointType, status: CheckpointStatus = "SEALED"): Checkpoint => ({ checkpointId: `id-${type}`, type, status, occurredAt: null });
// 테스트 도구: 시점 목록과 렌탈 상태로 렌탈을 만든다.
const rental = (checkpoints: Checkpoint[], status: Rental["status"] = "OPEN") => ({ status, checkpoints });

// [상황] 시점이 없음, 출고 봉인 전, 출고 봉인, 수령 촬영됨, 출고·수령 봉인, 반납 등급 매김·촬영 대기, 반납 봉인, 렌탈 종료 상태.
// [기대] 순서대로 출고 시작 → 출고 봉인 대기 → 수령 시작 → 수령 봉인 대기 → 반납 시작 → 반납 봉인 대기 → 렌탈 종료 → 할 일 없음을 알려 준다.
test.each([
  ["시점이 없으면 출고 시작", rental([]), { kind: "start", type: "OUT" }],
  ["출고가 봉인 전이면 출고 봉인 대기", rental([cp("OUT", "OPEN")]), { kind: "waitSeal", type: "OUT", status: "OPEN" }],
  ["출고가 봉인되면 수령 시작", rental([cp("OUT")]), { kind: "start", type: "RCV" }],
  ["수령이 봉인 전(촬영됨)이면 수령 봉인 대기", rental([cp("OUT"), cp("RCV", "CAPTURED")]), { kind: "waitSeal", type: "RCV", status: "CAPTURED" }],
  ["출고·수령이 봉인되면 반납 시작", rental([cp("OUT"), cp("RCV")]), { kind: "start", type: "RET" }],
  ["반납이 봉인 전(등급 매김)이면 봉인 대기", rental([cp("OUT"), cp("RCV"), cp("RET", "GRADED")], "RETURNED"), { kind: "waitSeal", type: "RET", status: "GRADED" }],
  ["반납이 봉인 전(촬영 대기)이면 봉인 대기", rental([cp("OUT"), cp("RCV"), cp("RET", "OPEN")], "RETURNED"), { kind: "waitSeal", type: "RET", status: "OPEN" }],
  ["반납이 봉인되면 렌탈 종료", rental([cp("OUT"), cp("RCV"), cp("RET")], "RETURNED"), { kind: "close" }],
  ["종료된 렌탈은 할 일이 없다", rental([cp("OUT"), cp("RCV"), cp("RET")], "CLOSED"), { kind: "closed" }],
])("%s", (_name, input, expected) => {
  expect(nextAction(input)).toEqual(expected);
});

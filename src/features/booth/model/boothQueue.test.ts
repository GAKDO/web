// 이 파일이 확인하는 것: 웹 부스 화면의 기기 목록 나누기. 지금 찍어야 하는 "기다리는 기기"와 이미 찍은 "최근 판정"으로 나눈다.

import { boothQueue } from "./boothQueue";
import type { RentalSummary } from "../../../shared/api/types";

// 테스트 도구: 렌탈 하나(지금 시점 정보 포함)를 만든다.
const rental = (id: string, cp: RentalSummary["currentCheckpoint"], status: RentalSummary["status"] = "OPEN"): RentalSummary =>
  ({ rentalId: id, deviceId: `d-${id}`, serial: `S-${id}`, modelCode: "MBA13-M2", status, currentCheckpoint: cp }) as RentalSummary;

// [상황] 출고 시점이 열린 기기(a), 출고가 봉인된 기기(b), 수령을 찍은 기기(c)가 있다.
// [기대] a만 기다리는 기기이고, b·c는 최근 판정에 최근 찍은 순서(c, b)로 들어간다.
test("지금 시점이 열린(OPEN) 기기는 기다리는 기기, 이미 찍은 기기는 최근 판정에 최근 순으로 들어간다", () => {
  const q = boothQueue([
    rental("a", { checkpointId: "ca", type: "OUT", status: "OPEN", occurredAt: null }),
    rental("b", { checkpointId: "cb", type: "OUT", status: "SEALED", occurredAt: "2026-11-06T01:00:00Z" }),
    rental("c", { checkpointId: "cc", type: "RCV", status: "CAPTURED", occurredAt: "2026-11-06T02:00:00Z" }),
  ]);
  expect(q.waiting.map((r) => r.rentalId)).toEqual(["a"]);
  expect(q.judged.map((r) => r.rentalId)).toEqual(["c", "b"]);
});

// [상황] 시점이 아직 없는 렌탈과 이미 종료된 렌탈이 있다.
// [기대] 어느 목록에도 넣지 않는다.
test("시점이 없거나 끝난 렌탈은 어느 목록에도 넣지 않는다", () => {
  const q = boothQueue([
    rental("a", null),
    rental("b", { checkpointId: "cb", type: "RET", status: "SEALED", occurredAt: "2026-11-06T01:00:00Z" }, "CLOSED"),
  ]);
  expect(q.waiting).toEqual([]);
  expect(q.judged).toEqual([]);
});

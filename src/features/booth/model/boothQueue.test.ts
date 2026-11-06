import { boothQueue } from "./boothQueue";
import type { RentalSummary } from "../../../shared/api/types";

const rental = (id: string, cp: RentalSummary["currentCheckpoint"], status: RentalSummary["status"] = "OPEN"): RentalSummary =>
  ({ rentalId: id, deviceId: `d-${id}`, serial: `S-${id}`, modelCode: "MBA13-M2", status, currentCheckpoint: cp }) as RentalSummary;

test("지금 시점이 열린(OPEN) 기기는 기다리는 기기, 이미 찍은 기기는 최근 판정에 최근 순으로 들어간다", () => {
  const q = boothQueue([
    rental("a", { checkpointId: "ca", type: "OUT", status: "OPEN", occurredAt: null }),
    rental("b", { checkpointId: "cb", type: "OUT", status: "SEALED", occurredAt: "2026-11-06T01:00:00Z" }),
    rental("c", { checkpointId: "cc", type: "RCV", status: "CAPTURED", occurredAt: "2026-11-06T02:00:00Z" }),
  ]);
  expect(q.waiting.map((r) => r.rentalId)).toEqual(["a"]);
  expect(q.judged.map((r) => r.rentalId)).toEqual(["c", "b"]);
});

test("시점이 없거나 끝난 렌탈은 어느 목록에도 넣지 않는다", () => {
  const q = boothQueue([
    rental("a", null),
    rental("b", { checkpointId: "cb", type: "RET", status: "SEALED", occurredAt: "2026-11-06T01:00:00Z" }, "CLOSED"),
  ]);
  expect(q.waiting).toEqual([]);
  expect(q.judged).toEqual([]);
});

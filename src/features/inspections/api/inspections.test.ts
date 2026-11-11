import { expect, test } from "vitest";
import type { Inspection } from "../../../shared/api/types";
import { INSPECTION_POLL_MS, inspectionPollMs } from "./inspections";

const inspection = (over: Partial<Inspection>): Inspection => ({
  checkpointId: "c1",
  grade: "A",
  ruleVersion: "grade-rules-v1",
  reasons: [],
  defects: [],
  ...over,
});

test("검사 결과가 아직 없으면(404 → null) 3초마다 다시 읽는다", () => {
  expect(inspectionPollMs(null)).toBe(INSPECTION_POLL_MS);
});

test("등급도 근거도 없는 결과는 기다리는 중이라 다시 읽고, 등급이 매겨지거나 판정 불가(근거만 있음)가 되면 멈춘다", () => {
  expect(inspectionPollMs(inspection({ grade: null, ruleVersion: null }))).toBe(INSPECTION_POLL_MS);
  expect(inspectionPollMs(inspection({ grade: "A" }))).toBe(false);
  expect(inspectionPollMs(inspection({ grade: "C" }))).toBe(false);
  expect(inspectionPollMs(inspection({ grade: null, reasons: ["판정 가능한 면이 없음"] }))).toBe(false);
});

test("아직 읽지 않았으면(undefined) 다시 읽기 간격을 정하지 않는다", () => {
  expect(inspectionPollMs(undefined)).toBe(false);
});

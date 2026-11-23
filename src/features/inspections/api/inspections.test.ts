// 이 파일이 확인하는 것: 관리자 검사 화면이 검사 결과를 몇 초마다 다시 읽을지(폴링) 정하는 규칙.

import { expect, test } from "vitest";
import type { Inspection } from "../../../shared/api/types";
import { INSPECTION_POLL_MS, inspectionPollMs } from "./inspections";

// 테스트 도구: 검사 결과 하나를 기본값에 바꿀 칸만 덮어써 만든다.
const inspection = (over: Partial<Inspection>): Inspection => ({
  checkpointId: "c1",
  grade: "A",
  ruleVersion: "grade-rules-v1",
  reasons: [],
  defects: [],
  ...over,
});

// [상황] 서버에 검사 결과가 아직 없다(404).
// [기대] 3초마다 다시 읽는다.
test("검사 결과가 아직 없으면(404 → null) 3초마다 다시 읽는다", () => {
  expect(inspectionPollMs(null)).toBe(INSPECTION_POLL_MS);
});

// [상황] 결과가 등급·근거 없이 왔거나(기다리는 중), 등급 A·C가 나왔거나, 판정 불가(근거만 있음)가 됐다.
// [기대] 기다리는 중이면 계속 다시 읽고, 등급이나 판정 불가가 나오면 멈춘다.
test("등급도 근거도 없는 결과는 기다리는 중이라 다시 읽고, 등급이 매겨지거나 판정 불가(근거만 있음)가 되면 멈춘다", () => {
  expect(inspectionPollMs(inspection({ grade: null, ruleVersion: null }))).toBe(INSPECTION_POLL_MS);
  expect(inspectionPollMs(inspection({ grade: "A" }))).toBe(false);
  expect(inspectionPollMs(inspection({ grade: "C" }))).toBe(false);
  expect(inspectionPollMs(inspection({ grade: null, reasons: ["판정 가능한 면이 없음"] }))).toBe(false);
});

// [상황] 아직 한 번도 읽지 않았다.
// [기대] 다시 읽기 간격을 정하지 않는다.
test("아직 읽지 않았으면(undefined) 다시 읽기 간격을 정하지 않는다", () => {
  expect(inspectionPollMs(undefined)).toBe(false);
});

import type { Inspection } from "../../../shared/api/types";
import { formatConfidence, formatMm, verdictOf } from "./verdict";

const inspection = (grade: Inspection["grade"], reasons: string[] = []): Inspection => ({
  checkpointId: "c",
  grade,
  ruleVersion: grade ? "grade-rules-v1" : null,
  reasons,
  defects: [],
});

test("시점이 없으면 검사 전이다", () => {
  expect(verdictOf(null, null).label).toBe("검사 전");
  expect(verdictOf(undefined, inspection("A")).kind).toBe("none");
});

test("검사 결과가 없으면(404) 촬영 대기 시점은 촬영 대기, 그 뒤는 판정 대기다", () => {
  expect(verdictOf({ status: "OPEN" }, null).label).toBe("촬영 대기");
  expect(verdictOf({ status: "CAPTURED" }, null).label).toBe("판정 대기");
  expect(verdictOf({ status: "CAPTURED" }, inspection(null)).kind).toBe("pending");
});

test("아직 읽는 중이면 판정 확인 중이다", () => {
  expect(verdictOf({ status: "GRADED" }, "loading").label).toBe("판정 확인 중");
});

test("등급 없이 근거만 있으면 판정 불가다", () => {
  expect(verdictOf({ status: "GRADED" }, inspection(null, ["판정 가능한 면이 없음"])).kind).toBe("ungradable");
});

test("A 등급은 문제 없음, B~D 등급은 문제 있음과 등급이다", () => {
  expect(verdictOf({ status: "SEALED" }, inspection("A"))).toEqual({ kind: "ok", grade: "A", label: "문제 없음" });
  expect(verdictOf({ status: "GRADED" }, inspection("C"))).toEqual({ kind: "bad", grade: "C", label: "문제 있음 · C등급" });
});

test("신뢰도는 %로 반올림하고 mm 값이 없으면 —다", () => {
  expect(formatConfidence(0.914)).toBe("91%");
  expect(formatMm(12.04)).toBe("12.0 mm");
  expect(formatMm(null)).toBe("—");
});

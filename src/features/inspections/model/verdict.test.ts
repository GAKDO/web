// 이 파일이 확인하는 것: 관리자 화면에 보이는 판정 문구(검사 전, 촬영 대기, 판정 대기, 문제 없음/있음 등)를 정하는 규칙.

import type { Inspection } from "../../../shared/api/types";
import { formatConfidence, formatMm, verdictOf } from "./verdict";

// 테스트 도구: 등급·근거로 검사 결과 하나를 만든다.
const inspection = (grade: Inspection["grade"], reasons: string[] = []): Inspection => ({
  checkpointId: "c",
  grade,
  ruleVersion: grade ? "grade-rules-v1" : null,
  reasons,
  defects: [],
});

// [상황] 시점이 아직 없다.
// [기대] "검사 전"이다(검사 결과가 있어도).
test("시점이 없으면 검사 전이다", () => {
  expect(verdictOf(null, null).label).toBe("검사 전");
  expect(verdictOf(undefined, inspection("A")).kind).toBe("none");
});

// [상황] 검사 결과가 없거나 등급이 아직 없다. 시점은 촬영 대기(OPEN) 또는 촬영됨(CAPTURED)이다.
// [기대] 촬영 전이면 "촬영 대기", 찍은 뒤면 "판정 대기"다.
test("검사 결과가 없으면(404) 촬영 대기 시점은 촬영 대기, 그 뒤는 판정 대기다", () => {
  expect(verdictOf({ status: "OPEN" }, null).label).toBe("촬영 대기");
  expect(verdictOf({ status: "CAPTURED" }, null).label).toBe("판정 대기");
  expect(verdictOf({ status: "CAPTURED" }, inspection(null)).kind).toBe("pending");
});

// [상황] 검사 결과를 읽는 중이다.
// [기대] "판정 확인 중"이다.
test("아직 읽는 중이면 판정 확인 중이다", () => {
  expect(verdictOf({ status: "GRADED" }, "loading").label).toBe("판정 확인 중");
});

// [상황] 등급 없이 "판정 가능한 면이 없음" 근거만 왔다.
// [기대] 판정 불가다.
test("등급 없이 근거만 있으면 판정 불가다", () => {
  expect(verdictOf({ status: "GRADED" }, inspection(null, ["판정 가능한 면이 없음"])).kind).toBe("ungradable");
});

// [상황] 등급 A와 C가 나왔다.
// [기대] A는 "문제 없음", C는 "문제 있음 · C등급"이다.
test("A 등급은 문제 없음, B~D 등급은 문제 있음과 등급이다", () => {
  expect(verdictOf({ status: "SEALED" }, inspection("A"))).toEqual({ kind: "ok", grade: "A", label: "문제 없음" });
  expect(verdictOf({ status: "GRADED" }, inspection("C"))).toEqual({ kind: "bad", grade: "C", label: "문제 있음 · C등급" });
});

// [상황] AI 확신도 0.914, 길이 12.04mm, 길이 없음을 표시한다.
// [기대] "91%", "12.0 mm", "—"로 보인다.
test("신뢰도는 %로 반올림하고 mm 값이 없으면 —다", () => {
  expect(formatConfidence(0.914)).toBe("91%");
  expect(formatMm(12.04)).toBe("12.0 mm");
  expect(formatMm(null)).toBe("—");
});

// 이 파일이 확인하는 것: 검사 결과에서 "일부 면 판정 불가" 경고. 사진은 있지만 면을 펼치지 못해 AI가 판정하지 못한 면을 알린다.

import { render, screen } from "@testing-library/react";
import type { Inspection } from "../../../shared/api/types";
import { UnjudgeableNotice } from "./UnjudgeableNotice";

const base: Inspection = { checkpointId: "cp", grade: "A", ruleVersion: "grade-rules-v1", reasons: [], defects: [], profile: "FULL", unjudgeableFaces: [] };

// [상황] 앞 옆면(SF)이 정합 실패 또는 품질 미달(CAM1)로 판정 불가다.
// [기대] "일부 면 판정 불가 · 1면" 경고와 그 사유가 보인다.
test("정합 실패 면이 있으면 일부 면 판정 불가를 경고하고 면과 사유를 보인다", () => {
  render(<UnjudgeableNotice inspection={{ ...base, unjudgeableFaces: [{ face: "SF", reason: "정합 실패 또는 품질 미달(CAM1)" }] }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("일부 면 판정 불가 · 1면");
  expect(screen.getByRole("alert")).toHaveTextContent("정합 실패 또는 품질 미달(CAM1)");
});

// [상황] 선택 면인 흰 화면(SCR1)만 "건너뜀"으로 판정 불가다.
// [기대] 일부러 건너뛴 것이라 경고하지 않는다.
test("건너뛴 선택 면만 있으면 경고하지 않는다", () => {
  render(<UnjudgeableNotice inspection={{ ...base, unjudgeableFaces: [{ face: "SCR1", reason: "건너뜀(스킵)" }] }} />);
  expect(screen.queryByRole("alert")).toBeNull();
});

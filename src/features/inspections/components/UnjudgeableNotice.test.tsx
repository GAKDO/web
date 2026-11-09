import { render, screen } from "@testing-library/react";
import type { Inspection } from "../../../shared/api/types";
import { UnjudgeableNotice } from "./UnjudgeableNotice";

const base: Inspection = { checkpointId: "cp", grade: "A", ruleVersion: "grade-rules-v1", reasons: [], defects: [], profile: "FULL", unjudgeableFaces: [] };

test("정합 실패 면이 있으면 일부 면 판정 불가를 경고하고 면과 사유를 보인다", () => {
  render(<UnjudgeableNotice inspection={{ ...base, unjudgeableFaces: [{ face: "SF", reason: "정합 실패 또는 품질 미달(CAM1)" }] }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("일부 면 판정 불가 · 1면");
  expect(screen.getByRole("alert")).toHaveTextContent("정합 실패 또는 품질 미달(CAM1)");
});

test("건너뛴 선택 면만 있으면 경고하지 않는다", () => {
  render(<UnjudgeableNotice inspection={{ ...base, unjudgeableFaces: [{ face: "SCR1", reason: "건너뜀(스킵)" }] }} />);
  expect(screen.queryByRole("alert")).toBeNull();
});

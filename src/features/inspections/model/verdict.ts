import type { Checkpoint, Inspection, InspectionGrade } from "../../../shared/api/types";
import { INSPECTION_GRADE_LABEL } from "../../../shared/codes/labels";

/**
 * 관리자 검사 결과 화면의 판정(spec 006 FR-003). 서버가 준 등급으로만 정하고 화면이 등급을 계산하지 않는다.
 * - none: 시점이 없다(검사 전)
 * - pending: 시점은 있지만 검사 결과가 아직 없다(404) 또는 등급이 아직 없다
 * - ungradable: 등급 없이 근거만 있다(판정 가능한 면이 없음)
 * - ok: A 등급(문제 없음), bad: B·C·D 등급(문제 있음)
 */
export type Verdict = { kind: "none" | "pending" | "ungradable"; grade: null; label: string } | { kind: "ok" | "bad"; grade: InspectionGrade; label: string };

/** 검사 결과 조회 상태. 404는 결과 없음(null), 아직 안 읽었으면 "loading" */
export type InspectionState = Inspection | null | "loading";

export function verdictOf(checkpoint: Pick<Checkpoint, "status"> | null | undefined, inspection: InspectionState): Verdict {
  if (!checkpoint) return { kind: "none", grade: null, label: "검사 전" };
  if (inspection === "loading") return { kind: "pending", grade: null, label: "판정 확인 중" };
  if (!inspection || inspection.grade === null) {
    if (inspection && inspection.reasons.length > 0) return { kind: "ungradable", grade: null, label: "판정 불가" };
    return { kind: "pending", grade: null, label: checkpoint.status === "OPEN" ? "촬영 대기" : "판정 대기" };
  }
  const grade = inspection.grade;
  return grade === "A" ? { kind: "ok", grade, label: "문제 없음" } : { kind: "bad", grade, label: `문제 있음 · ${INSPECTION_GRADE_LABEL[grade]}` };
}

/**
 * 수리 필요 여부. 화면이 새 규칙을 만들지 않고 서버 등급을 그대로 옮긴다(spec 006 FR-003):
 * A = 수리 필요 없음, B~D = 수리 필요, 등급이 없으면 아직 알 수 없음
 */
export function repairOf(verdict: Verdict): { label: string; needed: boolean | null } {
  if (verdict.kind === "ok") return { label: "수리 필요 없음", needed: false };
  if (verdict.kind === "bad") return { label: "수리 필요", needed: true };
  return { label: "아직 알 수 없음", needed: null };
}

/** 신뢰도(0~1)를 "91%"처럼 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** 길이·넓이 같은 mm 값. 원본 px 탐지라 없으면 "—" */
export function formatMm(value: number | null, unit = "mm"): string {
  return value === null ? "—" : `${value.toFixed(1)} ${unit}`;
}

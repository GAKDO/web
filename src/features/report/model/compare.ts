import type { CheckpointDiagnostics, DiagnosticsFlagKind, Grade, TimelineCheckpoint } from "../../../shared/api/types";
import { FLAG_LABEL } from "../../../shared/codes/labels";

// 시점 비교표의 한 열(FR-016~019). 화면은 이 값을 그리기만 한다
export interface CompareColumn {
  checkpointId: string;
  type: TimelineCheckpoint["type"];
  grade: Grade | null;
  newDefectCount: number;
  newDefectIds: string[];
  battery: Reading;
  cycles: Reading;
  ssd: Reading;
  flags: string[];
  /** 직전 시점과 비교한 배터리 차이(%p). 직전이 없거나 값이 없으면 null */
  batteryDeltaPct: number | null;
}

/** 읽은 값, 또는 읽지 못한 사유 */
export type Reading = { kind: "value"; text: string } | { kind: "missing"; reason: string };

const NO_DIAG: Reading = { kind: "missing", reason: "진단 기록 없음" };

function percent(value: number | null | undefined): Reading {
  return value == null ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: `${value.toFixed(1)}%` };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function flagText(kind: DiagnosticsFlagKind): string {
  return FLAG_LABEL[kind];
}

export function compareColumn(checkpoint: TimelineCheckpoint, diag: CheckpointDiagnostics | null | undefined): CompareColumn {
  const current = diag?.current;
  const battery = current ? (current.battery ? percent(current.battery.maxCapacityPct) : { kind: "missing" as const, reason: "배터리를 읽지 못함" }) : NO_DIAG;
  const cycleCount = current?.battery?.cycleCount;
  const cycles: Reading = !current ? NO_DIAG : cycleCount == null ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: `${cycleCount}회` };
  let ssd: Reading = NO_DIAG;
  if (current) {
    const s = current.ssd;
    if (!s) ssd = { kind: "missing", reason: "SSD를 읽지 못함" };
    else if (s.skippedReason) ssd = { kind: "missing", reason: s.skippedReason };
    else ssd = s.percentUsed == null ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: `수명 ${100 - s.percentUsed}% 남음` };
  }
  const now = current?.battery?.maxCapacityPct ?? checkpoint.diagnosticsSummary?.maxCapacityPct ?? null;
  const before = diag?.previous?.battery?.maxCapacityPct ?? null;
  const flagKinds = diag ? diag.flags.map((f) => f.kind) : (checkpoint.diagnosticsSummary?.flags ?? []);
  return {
    checkpointId: checkpoint.checkpointId,
    type: checkpoint.type,
    grade: checkpoint.grade,
    newDefectCount: checkpoint.newDefectCount,
    newDefectIds: checkpoint.pins.filter((p) => p.isNew).map((p) => p.defectId),
    battery,
    cycles,
    ssd,
    flags: [...new Set(flagKinds)].map(flagText),
    batteryDeltaPct: now != null && before != null ? round1(now - before) : null,
  };
}

/** "−7.2%p"처럼 부호를 붙인다. 0이면 "변화 없음" */
export function deltaText(delta: number): string {
  if (delta === 0) return "변화 없음";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}%p`;
}

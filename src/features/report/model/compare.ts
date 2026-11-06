import type { CheckpointDiagnostics, DiagnosticsFlagKind, Grade, TimelineCheckpoint } from "../../../shared/api/types";
import { FLAG_LABEL, SKIPPED_REASON_LABEL } from "../../../shared/codes/labels";

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
const DIAG_FAILED: Reading = { kind: "missing", reason: "진단을 불러오지 못함" };

/** SSD는 사용률(%)을 그대로 보이고, 경고·오류가 있으면 함께 적는다. 사용률은 100을 넘을 수 있어 남은 수명으로 바꾸지 않는다 */
function ssdReading(s: NonNullable<CheckpointDiagnostics["current"]["ssd"]>): Reading {
  const parts: string[] = [];
  if (s.percentUsed != null) parts.push(`사용률 ${s.percentUsed}%`);
  if (s.criticalWarning != null && s.criticalWarning !== 0) parts.push("경고 있음");
  if (s.mediaErrors != null && s.mediaErrors > 0) parts.push(`오류 ${s.mediaErrors}건`);
  return parts.length === 0 ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: parts.join(" · ") };
}

function percent(value: number | null | undefined): Reading {
  return value == null ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: `${value.toFixed(1)}%` };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function flagText(kind: DiagnosticsFlagKind): string {
  return FLAG_LABEL[kind];
}

/** 진단 한 번의 배터리·충전 횟수·SSD 읽은 값. 진단이 없으면(또는 못 불러오면) 그 사유를 넣는다. 렌탈 상세의 진단 결과 칸도 쓴다 */
export function diagnosticsReadings(current: CheckpointDiagnostics["current"] | null | undefined, diagFailed = false): { battery: Reading; cycles: Reading; ssd: Reading } {
  const none = diagFailed ? DIAG_FAILED : NO_DIAG;
  const battery = current ? (current.battery ? percent(current.battery.maxCapacityPct) : { kind: "missing" as const, reason: "배터리를 읽지 못함" }) : none;
  const cycleCount = current?.battery?.cycleCount;
  const cycles: Reading = !current ? none : cycleCount == null ? { kind: "missing", reason: "값을 읽지 못함" } : { kind: "value", text: `${cycleCount}회` };
  let ssd: Reading = none;
  if (current) {
    const s = current.ssd;
    if (!s) ssd = { kind: "missing", reason: "SSD를 읽지 못함" };
    else if (s.skippedReason) ssd = { kind: "missing", reason: SKIPPED_REASON_LABEL[s.skippedReason] };
    else ssd = ssdReading(s);
  }
  return { battery, cycles, ssd };
}

/** diagFailed: 진단 요청이 404가 아닌 오류로 실패함(기록 없음과 구분) */
export function compareColumn(checkpoint: TimelineCheckpoint, diag: CheckpointDiagnostics | null | undefined, diagFailed = false): CompareColumn {
  const current = diag?.current;
  const { battery, cycles, ssd } = diagnosticsReadings(current, diagFailed);
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

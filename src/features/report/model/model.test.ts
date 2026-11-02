import type { CheckpointDiagnostics, TimelineCheckpoint } from "../../../shared/api/types";
import { compareColumn, deltaText } from "./compare";
import { hasPendingCheckpoint, sliderCheckpoints, splitPins } from "./timeline";

const ID = "aaaaaaaaaaaaaaaaaaaaa";
function cp(type: TimelineCheckpoint["type"], status: TimelineCheckpoint["status"], extra: Partial<TimelineCheckpoint> = {}): TimelineCheckpoint {
  return { checkpointId: `${type}${ID}`.slice(0, 21), type, status, occurredAt: null, grade: null, newDefectCount: 0, pins: [], diagnosticsSummary: null, sealedAt: null, ...extra };
}

describe("시점 슬라이더", () => {
  test("슬라이더에는 봉인된 시점만 출고 → 수령 → 반납 순서로 오른다", () => {
    const list = [cp("RET", "GRADED"), cp("RCV", "SEALED"), cp("OUT", "SEALED")];
    expect(sliderCheckpoints(list).map((c) => c.type)).toEqual(["OUT", "RCV"]);
    expect(hasPendingCheckpoint(list)).toBe(true);
    expect(hasPendingCheckpoint(list.slice(1))).toBe(false);
  });

  test("신규 핀과 기존 핀을 계약의 isNew로 나눈다", () => {
    const c = cp("RCV", "SEALED", { pins: [{ defectId: ID, face: "TOP", x: 1, y: 1, isNew: true }, { defectId: ID, face: "BOT", x: 1, y: 1, isNew: false }] });
    const { newPins, existingPins } = splitPins(c);
    expect(newPins.map((p) => p.face)).toEqual(["TOP"]);
    expect(existingPins.map((p) => p.face)).toEqual(["BOT"]);
  });
});

describe("비교표 값", () => {
  const diag: CheckpointDiagnostics = {
    checkpointId: ID,
    current: { runId: ID, collectedAt: "2026-11-12T13:20:00+09:00", os: "MACOS", battery: { cycleCount: 112, designCapacity: 4382, fullChargeCapacity: 3681, capacityUnit: "mAh", maxCapacityPct: 84.0, condition: "NORMAL" }, ssd: { percentUsed: null, availableSparePct: null, criticalWarning: null, powerOnHours: null, mediaErrors: null, skippedReason: "smartctl 권한 없음" }, components: [], benchmarks: [] },
    previous: { runId: ID, collectedAt: "2026-11-12T09:02:00+09:00", os: "MACOS", battery: { cycleCount: 110, designCapacity: 4382, fullChargeCapacity: 3996, capacityUnit: "mAh", maxCapacityPct: 91.2, condition: "NORMAL" }, ssd: null, components: [], benchmarks: [] },
    flags: [{ kind: "CAPACITY_DROP", baseRunId: ID, detail: {} }],
  };

  test("배터리 최대 용량과 직전 시점 대비 차이, 플래그 문장, 읽지 못한 SSD 사유를 만든다", () => {
    const col = compareColumn(cp("RCV", "SEALED", { grade: "B", newDefectCount: 1 }), diag);
    expect(col.battery).toEqual({ kind: "value", text: "84.0%" });
    expect(col.batteryDeltaPct).toBe(-7.2);
    expect(deltaText(col.batteryDeltaPct ?? 0)).toBe("−7.2%p");
    expect(col.flags).toEqual(["배터리 용량이 크게 줄었습니다"]);
    expect(col.ssd).toEqual({ kind: "missing", reason: "smartctl 권한 없음" });
    expect(col.cycles).toEqual({ kind: "value", text: "112회" });
  });

  test("진단이 없으면 '진단 기록 없음'이고 차이는 없다", () => {
    const col = compareColumn(cp("OUT", "SEALED"), null);
    expect(col.battery).toEqual({ kind: "missing", reason: "진단 기록 없음" });
    expect(col.batteryDeltaPct).toBeNull();
  });
});

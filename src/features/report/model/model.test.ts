import type { CheckpointDiagnostics, TimelineCheckpoint } from "../../../shared/api/types";
import { compareColumn, deltaText } from "./compare";
import { faceNormal, lidInnerFace, pinPosition, pinRatio } from "./pins";
import { hasPendingCheckpoint, sliderCheckpoints, splitPins } from "./timeline";

const ID = "aaaaaaaaaaaaaaaaaaaaa";
function cp(type: TimelineCheckpoint["type"], status: TimelineCheckpoint["status"], extra: Partial<TimelineCheckpoint> = {}): TimelineCheckpoint {
  return { checkpointId: `${type}${ID}`.slice(0, 21), type, status, occurredAt: null, grade: null, newDefectCount: 0, pins: [], diagnosticsSummary: null, sealedAt: null, ...extra };
}
const dims = { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 6 };

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

  test("SSD는 사용률을 그대로 보이고(100% 넘어도), 경고·오류를 함께 적는다", () => {
    const ssd = { percentUsed: 120, availableSparePct: 5, criticalWarning: 1, powerOnHours: 9000, mediaErrors: 2, skippedReason: null };
    const col = compareColumn(cp("RCV", "SEALED"), { ...diag, current: { ...diag.current, ssd } });
    expect(col.ssd).toEqual({ kind: "value", text: "사용률 120% · 경고 있음 · 오류 2건" });
  });

  test("진단 요청이 실패하면 '진단을 불러오지 못함'으로 기록 없음과 구분한다", () => {
    expect(compareColumn(cp("OUT", "SEALED"), null, true).battery).toEqual({ kind: "missing", reason: "진단을 불러오지 못함" });
  });
});

describe("핀 위치", () => {
  test("면 사진 크기로 나눠 비율로 바꾸고, 범위 밖이거나 크기를 모르면 그리지 않는다", () => {
    const pin = { defectId: ID, face: "KB" as const, x: 150, y: 50, isNew: true };
    expect(pinRatio(pin, { width: 300, height: 100 })).toEqual({ u: 0.5, v: 0.5 });
    expect(pinRatio({ ...pin, x: 400 }, { width: 300, height: 100 })).toBeNull();
    expect(pinRatio(pin, undefined)).toBeNull();
  });

  test("키보드 면 가운데 핀은 본체 윗면 가운데에 놓인다", () => {
    expect(pinPosition("KB", { u: 0.5, v: 0.5 }, dims)).toEqual([0, 5, 0]);
  });

  test("90° 연 화면의 맨 위 가운데 핀은 경첩 위로 화면 깊이만큼 올라간다", () => {
    const [x, y, z] = pinPosition("SCR0", { u: 0.5, v: 0 }, dims, 90);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(205);
    expect(z).toBeCloseTo(-100);
  });

  test("90° 연 덮개 겉면은 뒤(−z)를, 화면은 앞(+z)을 본다", () => {
    const [, oy, oz] = faceNormal("TOP", 90);
    const [, iy, iz] = faceNormal("SCR0", 90);
    expect(oy).toBeCloseTo(0);
    expect(oz).toBeCloseTo(-1);
    expect(iy).toBeCloseTo(0);
    expect(iz).toBeCloseTo(1);
  });

  test("화면 안쪽에는 SCR0을 먼저, 없으면 SCR1을 입힌다", () => {
    expect(lidInnerFace(["SCR1", "SCR0"])).toBe("SCR0");
    expect(lidInnerFace(["SCR1"])).toBe("SCR1");
    expect(lidInnerFace(["TOP"])).toBeNull();
  });
});

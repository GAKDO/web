// 이 파일이 확인하는 것: 3D 리포트와 시점 비교표를 그리기 위한 계산들.
// 어떤 시점을 슬라이더에 올릴지, 진단(배터리·SSD) 비교 값과 문장, 흠집 핀을 3D 노트북 모형의 어느 자리에 꽂을지,
// 직전 시점과의 흠집 비교 문장을 만든다.

import type { CheckpointDiagnostics, Defect, TimelineCheckpoint } from "../../../shared/api/types";
import { compareColumn, deltaText } from "./compare";
import { matchText } from "./match";
import { lidInnerFace, pinPlacement, pinRatio, sideBaseShare } from "./pins";
import { hasPendingCheckpoint, sliderCheckpoints, splitPins } from "./timeline";

// 테스트 도구: 21자 가짜 번호.
const ID = "aaaaaaaaaaaaaaaaaaaaa";
// 테스트 도구: 원하는 종류(출고·수령·반납)와 상태의 시점 하나를 만든다. 나머지 칸은 비어 있다.
function cp(type: TimelineCheckpoint["type"], status: TimelineCheckpoint["status"], extra: Partial<TimelineCheckpoint> = {}): TimelineCheckpoint {
  return { checkpointId: `${type}${ID}`.slice(0, 21), type, status, occurredAt: null, grade: null, newDefectCount: 0, pins: [], diagnosticsSummary: null, sealedAt: null, ...extra };
}
// 테스트 도구: 3D 모형 크기. 가로 300mm·깊이 200mm·본체 두께 10mm·덮개 두께 6mm.
const dims = { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 6 };

// 테스트 묶음: 3D 보기의 시점 슬라이더.
describe("시점 슬라이더", () => {
  // [상황] 반납(검사 끝·봉인 전), 수령(봉인), 출고(봉인)가 뒤섞인 순서로 있다.
  // [기대] 슬라이더엔 봉인된 출고 → 수령만 순서대로 오른다. 봉인 전 시점이 있으면 "검사 중인 시점 있음"이 참이다.
  test("슬라이더에는 봉인된 시점만 출고 → 수령 → 반납 순서로 오른다", () => {
    const list = [cp("RET", "GRADED"), cp("RCV", "SEALED"), cp("OUT", "SEALED")];
    expect(sliderCheckpoints(list).map((c) => c.type)).toEqual(["OUT", "RCV"]);
    expect(hasPendingCheckpoint(list)).toBe(true);
    expect(hasPendingCheckpoint(list.slice(1))).toBe(false);
  });

  // [상황] 수령 시점에 신규 흠집(윗면)과 기존 흠집(바닥) 핀이 있다.
  // [기대] 계약의 isNew 값대로 신규(윗면)와 기존(바닥)으로 나눈다.
  test("신규 핀과 기존 핀을 계약의 isNew로 나눈다", () => {
    const c = cp("RCV", "SEALED", { pins: [{ defectId: ID, face: "TOP", x: 1, y: 1, isNew: true }, { defectId: ID, face: "BOT", x: 1, y: 1, isNew: false }] });
    const { newPins, existingPins } = splitPins(c);
    expect(newPins.map((p) => p.face)).toEqual(["TOP"]);
    expect(existingPins.map((p) => p.face)).toEqual(["BOT"]);
  });
});

// 테스트 묶음: 리포트의 시점 비교표에 들어갈 진단 값. 현재 진단은 배터리 84.0%(사이클 112), 직전은 91.2%이고,
// SSD는 권한이 없어 읽지 못했으며, "용량 크게 줄어듦" 플래그가 있다.
describe("비교표 값", () => {
  const diag: CheckpointDiagnostics = {
    checkpointId: ID,
    current: { runId: ID, collectedAt: "2026-11-12T13:20:00+09:00", os: "MACOS", battery: { cycleCount: 112, designCapacity: 4382, fullChargeCapacity: 3681, capacityUnit: "mAh", maxCapacityPct: 84.0, condition: "NORMAL", skippedReason: null }, ssd: { percentUsed: null, availableSparePct: null, criticalWarning: null, powerOnHours: null, mediaErrors: null, skippedReason: "NO_PERMISSION" }, components: [], benchmarks: [] },
    previous: { runId: ID, collectedAt: "2026-11-12T09:02:00+09:00", os: "MACOS", battery: { cycleCount: 110, designCapacity: 4382, fullChargeCapacity: 3996, capacityUnit: "mAh", maxCapacityPct: 91.2, condition: "NORMAL", skippedReason: null }, ssd: null, components: [], benchmarks: [] },
    flags: [{ kind: "CAPACITY_DROP", baseRunId: ID, detail: {} }],
  };

  // [상황] 위 진단으로 수령 시점의 비교표 칸을 만든다.
  // [기대] 배터리 "84.0%", 직전 대비 "−7.2%p", 플래그 문장 "배터리 용량이 크게 줄었습니다", SSD는 "권한 없음"으로 못 읽음, 사이클 "112회".
  test("배터리 최대 용량과 직전 시점 대비 차이, 플래그 문장, 읽지 못한 SSD 사유를 만든다", () => {
    const col = compareColumn(cp("RCV", "SEALED", { grade: "B", newDefectCount: 1 }), diag);
    expect(col.battery).toEqual({ kind: "value", text: "84.0%" });
    expect(col.batteryDeltaPct).toBe(-7.2);
    expect(deltaText(col.batteryDeltaPct ?? 0)).toBe("−7.2%p");
    expect(col.flags).toEqual(["배터리 용량이 크게 줄었습니다"]);
    expect(col.ssd).toEqual({ kind: "missing", reason: "권한 없음" });
    expect(col.cycles).toEqual({ kind: "value", text: "112회" });
  });

  // [상황] 진단을 한 번도 하지 않은 출고 시점이다.
  // [기대] 배터리 칸은 "진단 기록 없음"이고 차이는 계산하지 않는다.
  test("진단이 없으면 '진단 기록 없음'이고 차이는 없다", () => {
    const col = compareColumn(cp("OUT", "SEALED"), null);
    expect(col.battery).toEqual({ kind: "missing", reason: "진단 기록 없음" });
    expect(col.batteryDeltaPct).toBeNull();
  });

  // [상황] SSD 사용률이 120%이고 경고 1개·오류 2건이 있다.
  // [기대] 100%로 자르지 않고 "사용률 120% · 경고 있음 · 오류 2건"으로 보인다.
  test("SSD는 사용률을 그대로 보이고(100% 넘어도), 경고·오류를 함께 적는다", () => {
    const ssd = { percentUsed: 120, availableSparePct: 5, criticalWarning: 1, powerOnHours: 9000, mediaErrors: 2, skippedReason: null };
    const col = compareColumn(cp("RCV", "SEALED"), { ...diag, current: { ...diag.current, ssd } });
    expect(col.ssd).toEqual({ kind: "value", text: "사용률 120% · 경고 있음 · 오류 2건" });
  });

  // [상황] 진단을 불러오는 요청이 실패했다.
  // [기대] "진단을 불러오지 못함"으로 보여, 진단을 안 한 것("진단 기록 없음")과 구분한다.
  test("진단 요청이 실패하면 '진단을 불러오지 못함'으로 기록 없음과 구분한다", () => {
    expect(compareColumn(cp("OUT", "SEALED"), null, true).battery).toEqual({ kind: "missing", reason: "진단을 불러오지 못함" });
  });
});

// 테스트 묶음: 사진 위 흠집 좌표를 3D 모형 위 자리로 옮기는 계산. 모형의 가운데가 원점이고,
// x는 사용자 기준 오른쪽(+), y는 위(+), z는 앞(+, 사용자 쪽)이다.
describe("핀 위치", () => {
  // [상황] 300×100 사진의 가운데(150, 50)에 핀이 있다. 사진 밖 좌표와 사진 크기를 모르는 경우도 본다.
  // [기대] 가운데는 비율 (0.5, 0.5)가 되고, 사진 밖이거나 크기를 모르면 핀을 그리지 않는다.
  test("면 사진 크기로 나눠 비율로 바꾸고, 범위 밖이거나 크기를 모르면 그리지 않는다", () => {
    const pin = { defectId: ID, face: "KB" as const, x: 150, y: 50, isNew: true };
    expect(pinRatio(pin, { width: 300, height: 100 })).toEqual({ u: 0.5, v: 0.5 });
    expect(pinRatio({ ...pin, x: 400 }, { width: 300, height: 100 })).toBeNull();
    expect(pinRatio(pin, undefined)).toBeNull();
  });

  // [상황] 키보드 면 가운데 핀을 놓는다.
  // [기대] 본체 윗면 가운데(높이 5mm = 본체 두께의 절반 위)에 놓인다.
  test("키보드 면 가운데 핀은 본체 윗면 가운데에 놓인다", () => {
    expect(pinPlacement("KB", { u: 0.5, v: 0.5 }, dims).position).toEqual([0, 5, 0]);
  });

  // [상황] 덮개를 90° 연 상태에서 화면(SCR0) 맨 위 가운데 핀을 놓는다.
  // [기대] 경첩(뒤쪽) 위로 화면 깊이(200mm)만큼 올라간 자리에 놓인다.
  test("90° 연 화면의 맨 위 가운데 핀은 경첩 위로 화면 깊이만큼 올라간다", () => {
    const [x, y, z] = pinPlacement("SCR0", { u: 0.5, v: 0 }, dims, 90).position;
    expect(x).toBe(0);
    expect(y).toBeCloseTo(205);
    expect(z).toBeCloseTo(-100);
  });

  // [상황] 덮개를 90° 연 상태에서 덮개 겉면(TOP)과 화면(SCR0)의 핀이 바라보는 방향을 본다.
  // [기대] 덮개 겉면은 뒤쪽, 화면은 앞쪽(사용자 쪽)을 본다.
  test("90° 연 덮개 겉면은 뒤(−z)를, 화면은 앞(+z)을 본다", () => {
    const [, oy, oz] = pinPlacement("TOP", { u: 0.5, v: 0.5 }, dims, 90).normal;
    const [, iy, iz] = pinPlacement("SCR0", { u: 0.5, v: 0.5 }, dims, 90).normal;
    expect(oy).toBeCloseTo(0);
    expect(oz).toBeCloseTo(-1);
    expect(iy).toBeCloseTo(0);
    expect(iz).toBeCloseTo(1);
  });

  // contracts capture/faces.md: 면별 이미지 위쪽·왼쪽
  // [상황] 바닥 사진의 왼쪽 위 모서리 핀을 놓는다.
  // [기대] 모형 바닥의 뒤쪽·사용자 오른쪽 모서리에 놓인다(바닥을 아래에서 올려다본 방향이라 좌우가 바뀜, 계약 capture/faces.md 규칙).
  test("바닥 사진은 위쪽이 뒤, 왼쪽이 사용자 오른쪽이다", () => {
    const [x, y, z] = pinPlacement("BOT", { u: 0, v: 0 }, dims).position;
    expect([x, y, z]).toEqual([150, -5, -100]);
  });

  // [상황] 덮개를 닫은 상태에서 덮개 겉면 사진의 왼쪽 위 모서리 핀을 놓는다.
  // [기대] 덮개 윗면의 사용자 왼쪽·뒤쪽(경첩 쪽) 모서리에 놓인다.
  test("덮개 겉면(TOP) 사진은 위쪽이 경첩, 왼쪽이 사용자 왼쪽이다", () => {
    // 0°(닫힘)로 놓으면 덮개 윗면 왼쪽 뒤 모서리
    const [x, y, z] = pinPlacement("TOP", { u: 0, v: 0 }, dims, 0).position;
    expect(x).toBe(-150);
    expect(y).toBeCloseTo(5 + 6);
    expect(z).toBeCloseTo(-100);
  });

  // [상황] 왼쪽·오른쪽·뒤쪽 옆면 사진의 왼쪽 아래 모서리 핀을 놓는다.
  // [기대] 왼쪽 옆면은 뒤쪽 끝, 오른쪽 옆면은 앞쪽 끝, 뒤쪽 옆면은 사용자 오른쪽 끝에 놓인다(각 면을 바깥에서 본 방향).
  test("왼쪽 옆면은 왼쪽이 뒤, 오른쪽 옆면은 왼쪽이 앞이다", () => {
    expect(pinPlacement("SL", { u: 0, v: 1 }, dims).position).toEqual([-150, -5, -100]);
    expect(pinPlacement("SR", { u: 0, v: 1 }, dims).position).toEqual([150, -5, 100]);
    expect(pinPlacement("SB", { u: 0, v: 1 }, dims).position).toEqual([150, -5, -100]);
  });

  // [상황] 앞쪽 옆면 사진은 닫힌 노트북의 본체+덮개 두께(16mm)를 찍는다. 맨 아래·본체 경계·맨 위 핀을 놓는다.
  // [기대] 아래 10/16은 본체 옆(맨 아래 = 본체 바닥, 경계 = 본체 윗면), 맨 위는 덮개 앞 모서리라 90° 열면 경첩 위 높이로 올라간다.
  test("옆면 사진은 본체+덮개 높이라, 아래쪽은 본체 옆에, 위쪽은 연 덮개 옆 모서리에 놓인다", () => {
    expect(sideBaseShare(dims)).toBeCloseTo(10 / 16);
    // 맨 아래 = 본체 바닥, 본체 비율 경계 = 본체 윗면
    expect(pinPlacement("SF", { u: 0.5, v: 1 }, dims).position).toEqual([0, -5, 100]);
    const top = pinPlacement("SF", { u: 0.5, v: 1 - 10 / 16 }, dims).position;
    expect(top[1]).toBeCloseTo(5);
    // 맨 위 = 덮개 앞 모서리 바깥. 90° 열면 경첩 위로 깊이만큼, 뒤로 덮개 두께만큼
    const lidTop = pinPlacement("SF", { u: 0.5, v: 0 }, dims, 90);
    expect(lidTop.position[1]).toBeCloseTo(5 + 200);
    expect(lidTop.position[2]).toBeCloseTo(-100 - 6);
    expect(lidTop.normal[1]).toBeCloseTo(1);
  });

  // [상황] 덮개 안쪽(화면)에 입힐 사진을 고른다.
  // [기대] 꺼진 화면(SCR0)이 있으면 그것을, 없으면 흰 화면(SCR1)을 쓰고, 둘 다 없으면 입히지 않는다.
  test("화면 안쪽에는 SCR0을 먼저, 없으면 SCR1을 입힌다", () => {
    expect(lidInnerFace(["SCR1", "SCR0"])).toBe("SCR0");
    expect(lidInnerFace(["SCR1"])).toBe("SCR1");
    expect(lidInnerFace(["TOP"])).toBeNull();
  });
});

// 테스트 묶음: 흠집 상세에 보일 "직전 시점과 비교" 문장(검사 서버의 흠집 짝짓기 결과를 사람 말로 바꿈).
describe("matchText: 직전 시점과 비교(CA2 defect_match)", () => {
  const pin = { defectId: "d", face: "TOP" as const, x: 1, y: 1, isNew: false };
  const defect = (match: Defect["match"]): Defect => ({
    defectId: "d",
    face: "TOP",
    class: "scratch",
    polygon: [],
    lengthMm: null,
    areaMm2: null,
    confidence: 0.9,
    modelVersion: "m",
    source: "AUTO",
    match,
  });
  // [상황] 출고 시점 흠집이다.
  // [기대] "출고는 기준 시점이라 비교하지 않음".
  test("출고는 짝이 없어 비교하지 않는다고 보인다", () => {
    expect(matchText("OUT", defect(null), pin)).toBe("출고는 기준 시점이라 비교하지 않음");
  });
  // [상황] 직전 시점 흠집과 0.84mm 떨어진 자리에서 짝지어졌다.
  // [기대] "직전 시점부터 있던 흠집 (위치 차이 0.8mm)".
  test("기존 흠집은 위치 차이(mm)를 함께 보인다", () => {
    expect(matchText("RCV", defect({ status: "EXISTING", prevDefectId: "p", distanceMm: 0.84 }), pin)).toBe("직전 시점부터 있던 흠집 (위치 차이 0.8mm)");
  });
  // [상황] 핀은 기존으로 표시됐지만 검사 결과의 짝짓기는 신규다.
  // [기대] 검사 결과를 따라 "직전 시점에 없던 흠집".
  test("신규 흠집은 핀 값과 상관없이 match를 따른다", () => {
    expect(matchText("RET", defect({ status: "NEW", prevDefectId: null, distanceMm: null }), pin)).toBe("직전 시점에 없던 흠집");
  });
  // [상황] 검사 결과를 아직 못 받았고 핀은 신규로 표시돼 있다.
  // [기대] 핀 값을 따라 "직전 시점에 없던 흠집".
  test("검사 결과가 아직 없으면 핀의 isNew로 보인다", () => {
    expect(matchText("RCV", undefined, { ...pin, isNew: true })).toBe("직전 시점에 없던 흠집");
  });
});

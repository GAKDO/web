// 이 파일이 확인하는 것: 관리자 화면의 진단 추이 그래프(배터리 용량, 충전 횟수, CPU 점수가 시간에 따라 어떻게 변했는지).

import type { CheckpointDiagnostics, RunSummary } from "../../../shared/api/types";
import type { DiagnosedCheckpoint } from "./diagnostics";
import { axisLabels, shortDate, tooltipAlign, trendDomain, trendSeries } from "./trend";

// 테스트 도구: 진단 한 번(수집 시각, 배터리 최대 용량, CPU 점수)을 만든다. SSD는 권한 없음으로 못 읽은 상태다.
function run(collectedAt: string, maxCapacityPct: number | null, cpu?: number): RunSummary {
  return {
    runId: collectedAt,
    collectedAt,
    os: "MACOS",
    battery: maxCapacityPct === null ? null : { cycleCount: 10, designCapacity: 100, fullChargeCapacity: maxCapacityPct, capacityUnit: "mAh", maxCapacityPct, condition: "NORMAL", skippedReason: null },
    ssd: { percentUsed: null, availableSparePct: null, criticalWarning: null, powerOnHours: null, mediaErrors: null, skippedReason: "NO_PERMISSION" },
    components: [],
    benchmarks: cpu === undefined ? [] : [{ metric: "CPU_SINGLE", median: cpu }],
  };
}

// 테스트 도구: 렌탈·시점 종류에 진단을 붙인다.
function diagnosed(rentalId: string, type: DiagnosedCheckpoint["type"], current: RunSummary): DiagnosedCheckpoint {
  const diagnostics: CheckpointDiagnostics = { checkpointId: current.runId, current, previous: null, flags: [] };
  return { rentalId, renterRef: rentalId, createdAt: "2026-11-01T00:00:00Z", type, checkpointId: current.runId, diagnostics };
}

describe("진단 추이", () => {
  // [상황] 렌탈 두 개의 진단 세 건이 순서 없이 있고, 그중 하나는 배터리를 못 읽었다. SSD는 셋 다 못 읽었다.
  // [기대] 수집 시각 순(11/5, 11/6, 11/8)으로 늘어놓고, 못 읽은 배터리 값은 빈칸, 점에는 "R-1 반납" 같은 출처가 붙는다.
  //        한 번도 읽지 못한 지표(SSD)는 그래프를 만들지 않는다.
  it("진단을 수집 시각 순으로 늘어놓고, 한 번도 읽지 못한 지표는 그래프를 만들지 않는다", () => {
    const series = trendSeries([
      diagnosed("R-2", "OUT", run("2026-11-08T01:00:00Z", 90, 2500)),
      diagnosed("R-1", "OUT", run("2026-11-05T01:00:00Z", 92, 2600)),
      diagnosed("R-1", "RET", run("2026-11-06T01:00:00Z", null, 2550)),
    ]);
    expect(series.map((s) => s.key)).toEqual(["battery", "cycles", "CPU_SINGLE"]);
    const battery = series[0];
    expect(battery.points.map((p) => p.value)).toEqual([92, null, 90]);
    expect(battery.points.map((p) => p.label)).toEqual(["11/5", "11/6", "11/8"]);
    expect(battery.points[1].where).toBe("R-1 반납");
  });

  // [상황] UTC 11/5 16:00 진단의 날짜를 쓴다.
  // [기대] 서울 시간으로 11/6이다.
  it("축 날짜는 서울 날짜로 쓴다", () => {
    expect(shortDate("2026-11-05T16:00:00Z")).toBe("11/6");
  });

  // [상황] 값 범위가 84~91.2, 0~2, 50 하나뿐이다.
  // [기대] 위아래로 여유를 두되 0 아래로는 내리지 않고, 값이 하나면 ±10으로 잡는다.
  it("세로 눈금은 값 범위에 여유를 두고 0 아래로 내리지 않는다", () => {
    const [lo, hi] = trendDomain([84, 91.2]);
    expect(lo).toBeLessThan(84);
    expect(hi).toBeGreaterThan(91.2);
    expect(trendDomain([0, 2])[0]).toBe(0);
    expect(trendDomain([50])).toEqual([40, 60]);
  });

  // [상황] 같은 날 두 번, 다음 날 한 번 진단했다.
  // [기대] 가로축에 같은 날 두 번째는 날짜 대신 서울 시각(14:30)을 쓴다.
  it("같은 날 진단이 이어지면 가로축에 날짜 대신 서울 시각을 쓴다", () => {
    const points = ["2026-11-09T01:00:00Z", "2026-11-09T05:30:00Z", "2026-11-10T02:00:00Z"].map((collectedAt) => ({ collectedAt, label: shortDate(collectedAt) }));
    expect(axisLabels(points)).toEqual(["11/9", "14:30", "11/10"]);
  });

  // [상황] 점이 7개라 일부에만 이름을 달고, 또 연도만 다른 같은 날짜 두 개가 있다.
  // [기대] 이름을 다는 점끼리 날짜를 비교해 날짜/시각을 정하고, 연도가 다르면 같은 날로 보지 않는다.
  it("이름을 다는 점끼리 날짜를 비교하고, 연도가 다르면 같은 날로 보지 않는다", () => {
    // 7개면 0·2·4·6번에만 이름: 1번에서 날짜가 바뀌어도 2번은 시각이 아니라 날짜
    const isos = ["2026-11-09T01:00:00Z", "2026-11-10T01:00:00Z", "2026-11-10T02:00:00Z", "2026-11-10T03:00:00Z", "2026-11-10T04:00:00Z", "2026-11-10T05:00:00Z", "2026-11-10T06:00:00Z"];
    const points = isos.map((collectedAt) => ({ collectedAt, label: shortDate(collectedAt) }));
    expect(axisLabels(points)).toEqual(["11/9", "", "11/10", "", "13:00", "", "15:00"]);
    const years = ["2025-11-09T01:00:00Z", "2026-11-09T01:00:00Z"].map((collectedAt) => ({ collectedAt, label: shortDate(collectedAt) }));
    expect(axisLabels(years)).toEqual(["11/9", "11/9"]);
  });

  // [상황] 그래프 왼쪽 끝, 가운데, 오른쪽 끝 점의 툴팁 위치를 정한다.
  // [기대] 끝 점은 그래프 안쪽으로 펼쳐 화면 밖으로 잘리지 않는다.
  it("가장자리 점의 툴팁은 그래프 안쪽으로 펼친다", () => {
    expect(tooltipAlign(0)).toBe("start");
    expect(tooltipAlign(50)).toBe("center");
    expect(tooltipAlign(100)).toBe("end");
  });
});

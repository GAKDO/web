import type { CheckpointDiagnostics, RunSummary } from "../../../shared/api/types";
import type { DiagnosedCheckpoint } from "./diagnostics";
import { axisLabels, shortDate, tooltipAlign, trendDomain, trendSeries } from "./trend";

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

function diagnosed(rentalId: string, type: DiagnosedCheckpoint["type"], current: RunSummary): DiagnosedCheckpoint {
  const diagnostics: CheckpointDiagnostics = { checkpointId: current.runId, current, previous: null, flags: [] };
  return { rentalId, renterRef: rentalId, createdAt: "2026-11-01T00:00:00Z", type, checkpointId: current.runId, diagnostics };
}

describe("진단 추이", () => {
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

  it("축 날짜는 서울 날짜로 쓴다", () => {
    expect(shortDate("2026-11-05T16:00:00Z")).toBe("11/6");
  });

  it("세로 눈금은 값 범위에 여유를 두고 0 아래로 내리지 않는다", () => {
    const [lo, hi] = trendDomain([84, 91.2]);
    expect(lo).toBeLessThan(84);
    expect(hi).toBeGreaterThan(91.2);
    expect(trendDomain([0, 2])[0]).toBe(0);
    expect(trendDomain([50])).toEqual([40, 60]);
  });

  it("같은 날 진단이 이어지면 가로축에 날짜 대신 서울 시각을 쓴다", () => {
    const points = ["2026-11-09T01:00:00Z", "2026-11-09T05:30:00Z", "2026-11-10T02:00:00Z"].map((collectedAt) => ({ collectedAt, label: shortDate(collectedAt) }));
    expect(axisLabels(points)).toEqual(["11/9", "14:30", "11/10"]);
  });

  it("가장자리 점의 툴팁은 그래프 안쪽으로 펼친다", () => {
    expect(tooltipAlign(0)).toBe("start");
    expect(tooltipAlign(50)).toBe("center");
    expect(tooltipAlign(100)).toBe("end");
  });
});

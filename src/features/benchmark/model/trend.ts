import type { RunSummary } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { type DiagnosedCheckpoint, METRIC_LABEL, METRICS, metricValue } from "./diagnostics";

/** 추이 그래프 한 장: 지표 하나를 진단 날짜 순서로 */
export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  /** 클수록 좋은 값인지(설명 문구용) */
  higherIsBetter: boolean;
  points: TrendPoint[];
}

export interface TrendPoint {
  /** 진단 수집 시각(ISO) */
  collectedAt: string;
  /** 축 아래 짧은 이름 "11/6" */
  label: string;
  /** 툴팁·표에 쓰는 시점 이름 "R-201 출고" */
  where: string;
  /** 그 진단에서 읽지 못했으면 null(선은 그 점을 건너뛴다) */
  value: number | null;
}

/** "11/6"(서울 날짜). 같은 날 진단이 여럿이어도 축 이름은 같고, 툴팁에 시각이 따로 보인다 */
export function shortDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${month}/${day}`;
}

interface Def {
  key: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  read: (run: RunSummary) => number | null;
}

/** 그래프로 그릴 지표. 배터리·SSD는 읽지 못하면 null, 벤치마크는 3회 중앙값 */
const DEFS: Def[] = [
  { key: "battery", label: "배터리 최대 용량", unit: "%", higherIsBetter: true, read: (r) => r.battery?.maxCapacityPct ?? null },
  { key: "cycles", label: "배터리 충전 횟수", unit: "회", higherIsBetter: false, read: (r) => r.battery?.cycleCount ?? null },
  { key: "ssd", label: "SSD 사용률", unit: "%", higherIsBetter: false, read: (r) => (r.ssd && !r.ssd.skippedReason ? r.ssd.percentUsed : null) },
  ...METRICS.map((m) => ({
    key: m,
    label: `${METRIC_LABEL[m]} (3회 중앙값)`,
    unit: m.startsWith("CPU") ? " ops/s" : " MB/s",
    higherIsBetter: true,
    read: (r: RunSummary) => metricValue(r, m),
  })),
];

/**
 * 기기의 진단 기록을 수집 시각 순으로 늘어놓고 지표마다 한 줄로 만든다.
 * 한 번도 읽지 못한 지표(예: 권한이 없어 SSD를 못 읽음)는 그래프를 만들지 않는다
 */
export function trendSeries(diagnosed: DiagnosedCheckpoint[]): TrendSeries[] {
  const runs = [...diagnosed].sort((a, b) => a.diagnostics.current.collectedAt.localeCompare(b.diagnostics.current.collectedAt));
  return DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    unit: d.unit,
    higherIsBetter: d.higherIsBetter,
    points: runs.map((r) => ({
      collectedAt: r.diagnostics.current.collectedAt,
      label: shortDate(r.diagnostics.current.collectedAt),
      where: `${r.renterRef} ${CHECKPOINT_TYPE_LABEL[r.type]}`,
      value: d.read(r.diagnostics.current),
    })),
  })).filter((s) => s.points.some((p) => p.value !== null));
}

/** 세로 눈금: 값 범위에 위아래 여유를 두고 보기 좋은 수로 내림·올림. 값이 하나뿐이면 그 값 ±10% */
export function trendDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;
  }
  const step = 10 ** Math.floor(Math.log10(hi - lo));
  const min = Math.floor(lo / step) * step;
  // 음수가 될 수 없는 값(%, 횟수, 속도)이라 0 아래로는 내리지 않는다
  return [Math.max(0, min), Math.ceil(hi / step) * step];
}

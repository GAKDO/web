import type { CheckpointDiagnostics, CheckpointType, RunSummary } from "../../../shared/api/types";

export type BenchmarkMetric = RunSummary["benchmarks"][number]["metric"];

/** 진단 벤치마크 지표 이름(codes.yaml diagnostics.benchmark_metric). 값은 에이전트가 잰 중앙값이고 클수록 좋다 */
export const METRIC_LABEL: Record<BenchmarkMetric, string> = {
  CPU_SINGLE: "CPU 단일 코어",
  CPU_MULTI: "CPU 멀티 코어",
  MEM_COPY: "메모리 복사",
  DISK_READ: "디스크 읽기",
  DISK_WRITE: "디스크 쓰기",
};
export const METRICS: BenchmarkMetric[] = ["CPU_SINGLE", "CPU_MULTI", "MEM_COPY", "DISK_READ", "DISK_WRITE"];

/** 기기의 진단 한 번: 어느 렌탈의 어느 시점에서 올라왔는지와 서버 요약 */
export interface DiagnosedCheckpoint {
  rentalId: string;
  renterRef: string;
  /** 렌탈 생성 시각(기록 순서) */
  createdAt: string;
  type: CheckpointType;
  checkpointId: string;
  diagnostics: CheckpointDiagnostics;
}

/** 렌탈 전(출고)과 후(반납, 없으면 그 렌탈의 가장 늦은 진단) */
export interface RentalPair {
  before: DiagnosedCheckpoint | null;
  after: DiagnosedCheckpoint | null;
}

const ORDER: Record<CheckpointType, number> = { OUT: 0, RCV: 1, RET: 2 };

/**
 * 렌탈 하나의 비교 쌍. 전 = 출고 진단, 후 = 반납 진단(없으면 수령). 출고가 없으면 전은 null.
 * 출고 하나뿐이면 후는 null(아직 반납 전)
 */
export function pairOf(rentalId: string, all: DiagnosedCheckpoint[]): RentalPair {
  const mine = all.filter((d) => d.rentalId === rentalId).sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  const before = mine.find((d) => d.type === "OUT") ?? null;
  const later = mine.filter((d) => d.type !== "OUT");
  return { before, after: later.length ? later[later.length - 1] : null };
}

export function metricValue(run: RunSummary | undefined, metric: BenchmarkMetric): number | null {
  return run?.benchmarks.find((b) => b.metric === metric)?.median ?? null;
}

/** 변화율(%): 후/전 − 1. 어느 쪽이든 없으면 null */
export function changePct(before: number | null | undefined, after: number | null | undefined): number | null {
  if (before == null || after == null || before === 0) return null;
  return ((after - before) / before) * 100;
}

/** "−12.3%"·"+0.4%" */
export function formatPct(p: number | null): string {
  if (p === null) return "—";
  const v = Math.round(p * 10) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}%`;
}

/** 측정값 표시: 큰 값은 천 단위 쉼표, 작은 값은 소수 한 자리 */
export function formatValue(v: number | null): string {
  if (v === null) return "—";
  return v >= 100 ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(1);
}

/** 성능이 이만큼 넘게 떨어지면 화면에 '떨어짐'으로 표시한다(서버 BENCH_DROP 플래그와 따로, 눈으로 보기 위한 기준) */
export const DROP_WARN_PCT = -10;

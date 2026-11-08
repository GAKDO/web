import type { BenchmarkMetric, Grade } from "../../../shared/api/types";

// 공개 기기 목록·상세의 숫자 표시. 표에서는 짧게(만 단위), 상세에서는 전부 쓴다.

export const BENCH_LABEL: Record<BenchmarkMetric, string> = {
  CPU_SINGLE: "CPU 단일 코어",
  CPU_MULTI: "CPU 멀티 코어",
  MEM_COPY: "메모리 복사",
  DISK_READ: "디스크 읽기",
  DISK_WRITE: "디스크 쓰기",
};

export const BENCH_UNIT: Record<BenchmarkMetric, string> = {
  CPU_SINGLE: "ops/s",
  CPU_MULTI: "ops/s",
  MEM_COPY: "MB/s",
  DISK_READ: "MB/s",
  DISK_WRITE: "MB/s",
};

const COMPACT = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const FULL = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export const DASH = "—";

/** 표: 159.1만처럼 짧게 */
export function compact(n: number | null): string {
  return n === null ? DASH : COMPACT.format(n);
}

/** 상세: 1,591,467 ops/s처럼 전부 */
export function full(n: number | null, unit: string): string {
  return n === null ? DASH : `${FULL.format(n)} ${unit}`;
}

export function percent(n: number | null): string {
  return n === null ? DASH : `${n.toFixed(1).replace(/\.0$/, "")}%`;
}

/** 등급 배지 색: A 초록 → D 빨강. 글자(A~D)도 함께 써서 색만으로 구분하지 않는다 */
export const GRADE_TONE: Record<Grade, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  B: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  D: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

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

/**
 * 등급 표시 색: A 초록 → D 빨강. 글자(A~D)도 함께 써서 색만으로 구분하지 않는다.
 * 11/10: 다크 모드에서 글자만 밝아져 흰 바탕에서 안 보이던 C등급을 고쳤다. 밝은 바탕 + 900 글자 + 테두리로
 * 모든 등급이 WCAG AA(작은 글자 4.5:1)를 넉넉히 넘는다(약 8~10:1). 사이트 전체 dark: 변형은 index.css에서 껐다
 */
export const GRADE_TONE: Record<Grade, string> = {
  A: "border-emerald-300 bg-emerald-50 text-emerald-900",
  B: "border-lime-300 bg-lime-50 text-lime-900",
  C: "border-amber-300 bg-amber-50 text-amber-900",
  D: "border-red-300 bg-red-50 text-red-900",
};

/** 등급 한 줄 뜻. 이용 안내 등급표(guide/content.ts GRADES)와 같은 말을 쓴다 */
export const GRADE_MEANING: Record<Grade, string> = {
  A: "문제 없음",
  B: "가벼운 긁힘",
  C: "수리 검토",
  D: "수리 필요",
};

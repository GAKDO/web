import type { CaptureBenchmark } from "../../../shared/api/types";

/** 부스 판정 목표(NFR-01): 촬영 시작 버튼부터 판정까지 30초 */
export const BOOTH_TARGET_MS = 30_000;

export interface BoothBar {
  label: string;
  /** Jetson 탐지(inferenceMs) */
  detectMs: number;
  /** 촬영·그 밖(boothTotalMs − 탐지) */
  otherMs: number;
  totalMs: number;
}

export interface TimingStats {
  /** 부스 판정 시간이 있는 세트(오래된 것부터, 그래프 순서) */
  booth: BoothBar[];
  boothMedianMs: number | null;
  boothWithinTarget: number;
  /** 부스 판정 시간이 있는 전체 세트 수(그래프는 최근 것만) */
  boothCount: number;
  inferenceMedianMs: number | null;
  /** 서버: 촬영 완료 → 등급(출처별) */
  serverMedianMs: { BOOTH: number | null; PHONE: number | null };
  /** 폰 세트 처리 시간(오래된 것부터) */
  phone: { label: string; ms: number }[];
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** 세트 시각 라벨: 서울 시간 "11-06 14:02" */
export function setLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).slice(5);
  const time = d.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

/** 초 한 자리: 28.4초 */
export const formatSeconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}초`);

/**
 * 서버가 준 세트별 시간만으로 숫자를 낸다(화면이 시간을 지어내지 않음). 출처가 섞이면 부스 막대가 묻히므로
 * 부스(버튼→판정, 30초 목표)와 폰(서버 CPU, 촬영 완료→등급)을 따로 모은다. items는 최근 것부터 온다
 */
export function buildTiming(items: CaptureBenchmark[], recent = 20): TimingStats {
  const oldestFirst = [...items].reverse();
  const boothSets = oldestFirst.filter((i) => i.source === "BOOTH" && i.boothTotalMs != null);
  const booth = boothSets.slice(-recent).map((i) => {
    const totalMs = i.boothTotalMs ?? 0;
    const detectMs = Math.min(i.inferenceMs ?? 0, totalMs);
    return { label: setLabel(i.createdAt), detectMs, otherMs: totalMs - detectMs, totalMs };
  });
  const totals = boothSets.map((i) => i.boothTotalMs ?? 0);
  const server = (source: "BOOTH" | "PHONE") =>
    median(items.filter((i) => i.source === source && i.completedToGradedMs != null).map((i) => i.completedToGradedMs ?? 0));
  return {
    booth,
    boothMedianMs: median(totals),
    boothWithinTarget: totals.filter((t) => t <= BOOTH_TARGET_MS).length,
    boothCount: totals.length,
    inferenceMedianMs: median(items.filter((i) => i.source === "BOOTH" && i.inferenceMs != null).map((i) => i.inferenceMs ?? 0)),
    serverMedianMs: { BOOTH: server("BOOTH"), PHONE: server("PHONE") },
    phone: oldestFirst
      .filter((i) => i.source === "PHONE" && i.completedToGradedMs != null)
      .slice(-recent)
      .map((i) => ({ label: setLabel(i.createdAt), ms: i.completedToGradedMs ?? 0 })),
  };
}

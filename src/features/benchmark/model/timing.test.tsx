import { render, screen } from "@testing-library/react";
import { ColumnChart } from "../components/ColumnChart";
import { describe, expect, it } from "vitest";
import type { CaptureBenchmark } from "../../../shared/api/types";
import { buildTiming, median } from "./timing";

const item = (i: number, source: "BOOTH" | "PHONE", boothTotalMs: number | null, inferenceMs: number | null, completedToGradedMs: number | null): CaptureBenchmark => ({
  captureSetId: `s${i}`,
  checkpointId: `c${i}`,
  source,
  profile: "QUICK",
  boothId: null,
  modelVersion: "m1",
  photoCount: 12,
  inferenceMs,
  createdAt: `2026-11-06T0${i}:00:00+09:00`,
  completedAt: null,
  detectionsReceivedAt: null,
  gradedAt: null,
  completedToGradedMs,
  boothTotalMs,
});

describe("처리 시간 집계", () => {
  it("부스와 폰을 나눠 세고, 부스 막대는 탐지와 나머지로 쪼개 오래된 것부터 놓는다", () => {
    // 서버는 최근 것부터 준다
    const t = buildTiming([item(4, "PHONE", null, null, 90000), item(3, "BOOTH", 34000, 12000, 6000), item(2, "BOOTH", 26000, 30000, 5000), item(1, "BOOTH", null, 11000, null)]);
    expect(t.booth.map((b) => [b.detectMs, b.otherMs])).toEqual([
      [26000, 0], // 탐지 값이 전체보다 크면 전체로 자른다
      [12000, 22000],
    ]);
    expect(t).toMatchObject({ boothMedianMs: 30000, boothWithinTarget: 1, boothCount: 2, inferenceMedianMs: 12000 });
    expect(t.serverMedianMs).toEqual({ BOOTH: 5500, PHONE: 90000 });
    expect(t.phone.map((p) => p.ms)).toEqual([90000]);
  });

  it("값이 없으면 중간값은 null", () => {
    expect(median([])).toBeNull();
    expect(buildTiming([]).boothMedianMs).toBeNull();
  });
});

describe("같은 분에 만든 세트", () => {
  it("라벨이 같아도 막대가 모두 그려진다", () => {
    render(<ColumnChart title="t" unit="초" columns={[{ label: "11-06 14:02", values: [20] }, { label: "11-06 14:02", values: [25] }]} series={[{ name: "a", color: "#000" }]} />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

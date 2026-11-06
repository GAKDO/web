import { describe, expect, it } from "vitest";
import type { Checkpoint, Inspection, PhotoDefect } from "../../../shared/api/types";
import { niceMax } from "../components/ColumnChart";
import { buildStats, confidenceBins, seoulDay } from "./stats";

const cp = (id: string, status: Checkpoint["status"], occurredAt: string | null): Checkpoint => ({ checkpointId: id, type: "OUT", status, occurredAt });
const pd = (light: PhotoDefect["light"], camera: PhotoDefect["camera"], confidence: number): PhotoDefect => ({
  defectId: `d-${light}-${camera}-${confidence}`,
  face: "TOP",
  light,
  camera,
  class: "scratch",
  polygon: [[0, 0], [1, 0], [1, 1]],
  confidence,
  modelVersion: "yolo11s-seg-v001",
});
const insp = (id: string, grade: Inspection["grade"], photoDefects: PhotoDefect[] = [], reasons: string[] = []): Inspection => ({ checkpointId: id, grade, ruleVersion: "r1", reasons, defects: [], photoDefects });

describe("성능 그래프 집계", () => {
  it("서버 등급만으로 문제 없음·있음을 세고, 등급 없는 시점과 촬영 대기 시점은 뺀다", () => {
    const s = buildStats([
      { checkpoint: cp("a", "SEALED", "2026-11-05T10:00:00+09:00"), inspection: insp("a", "A") },
      { checkpoint: cp("b", "GRADED", "2026-11-05T23:30:00+09:00"), inspection: insp("b", "C", [pd("L2", "CAM1", 0.91), pd("L3", "CAM2", 0.55)]) },
      { checkpoint: cp("c", "CAPTURED", "2026-11-06T09:00:00+09:00"), inspection: null },
      { checkpoint: cp("d", "OPEN", null), inspection: null },
    ]);
    expect(s).toMatchObject({ graded: 2, ok: 1, bad: 1, ungraded: 1, defectCount: 2 });
    expect(s.grades).toEqual({ A: 1, B: 0, C: 1, D: 0 });
    expect(s.byDay).toEqual([{ day: "2026-11-05", ok: 1, bad: 1 }]);
    expect(s.byLight).toEqual([
      { light: "L2", cams: { CAM1: 1 } },
      { light: "L3", cams: { CAM2: 1 } },
    ]);
    expect(s.meanConfidence).toBeCloseTo(0.73);
    expect(s.modelVersions).toEqual([{ label: "yolo11s-seg-v001", count: 2 }]);
  });

  it("신뢰도 100%는 마지막 구간에 넣는다", () => {
    const bins = confidenceBins([0, 0.05, 0.95, 1]);
    expect(bins[0].count).toBe(2);
    expect(bins[9].count).toBe(2);
  });

  it("날짜는 서울 시간으로 묶는다", () => {
    expect(seoulDay("2026-11-05T16:00:00Z")).toBe("2026-11-06");
  });
});

describe("그래프 눈금", () => {
  it("가운데 눈금이 정수가 되게 짝수로 올린다", () => {
    expect([0, 1, 2, 3, 5, 7, 9, 13, 45].map(niceMax)).toEqual([2, 2, 2, 4, 6, 8, 10, 20, 60]);
  });
});

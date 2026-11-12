import { describe, expect, it } from "vitest";
import type { CheckpointMedia, Inspection } from "../../../shared/api/types";
import { candidateShots, cropBox } from "./candidateShots";
import { reviewGroups } from "./review";

const pd = (defectId: string, light: "L1" | "L2", confidence: number) => ({
  defectId,
  groupId: "g1",
  face: "TOP",
  camera: "CAM1",
  light,
  class: "SCRATCH",
  confidence,
  polygon: [
    [100, 100],
    [140, 100],
    [140, 120],
  ],
  source: "AUTO",
});

const quick = { profile: "QUICK", defects: [], photoDefects: [pd("a", "L1", 0.3), pd("b", "L2", 0.6)] } as unknown as Inspection;
const media = {
  photos: [
    { face: "TOP", camera: "CAM1", light: "L1", url: "https://x/l1.jpg" },
    { face: "TOP", camera: "CAM1", light: "L2", url: "https://x/l2.jpg" },
  ],
  textures: [{ face: "TOP", url: "https://x/top.jpg" }],
  crops: [],
} as unknown as CheckpointMedia;

describe("검수 후보 카드 사진", () => {
  it("빠른 검사 후보는 잡힌 원본 사진을 신뢰도 높은 순으로 보인다", () => {
    const [group] = reviewGroups(quick);
    const shots = candidateShots(group, quick, media);
    expect(shots.map((s) => s.src)).toEqual(["https://x/l2.jpg", "https://x/l1.jpg"]);
    expect(shots[0].light).toBe("L2");
  });

  it("전체 검사에서 원본 사진 px가 없는 후보는 정합된 면 사진 위에 보인다", () => {
    const full = {
      profile: "FULL",
      photoDefects: [],
      defects: [{ defectId: "d", face: "TOP", class: "DENT", confidence: 0.5, polygon: [[10, 10], [20, 20], [10, 20]], source: "AUTO" }],
    } as unknown as Inspection;
    const [group] = reviewGroups(full);
    const [shot] = candidateShots(group, full, media);
    expect(shot.src).toBe("https://x/top.jpg");
    expect(shot.camera).toBeNull();
  });

  it("사진 목록이 없으면 빈 목록", () => {
    const [group] = reviewGroups(quick);
    expect(candidateShots(group, quick, null)).toEqual([]);
  });

  it("확대 영역은 후보를 감싸고 4:3이며 사진 밖으로 나가지 않는다", () => {
    const box = cropBox([[10, 10], [30, 20]], 1920, 1080);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeLessThanOrEqual(10);
    expect(box.x + box.width).toBeGreaterThanOrEqual(30);
    expect(box.width / box.height).toBeCloseTo(4 / 3);
    const big = cropBox([[0, 0], [1900, 1000]], 1920, 1080);
    expect(big.x + big.width).toBeLessThanOrEqual(1920);
    expect(big.y + big.height).toBeLessThanOrEqual(1080);
  });
});

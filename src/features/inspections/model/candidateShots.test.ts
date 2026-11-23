// 이 파일이 확인하는 것: 관리자 검수 화면의 후보 카드에 어떤 사진을 보여 줄지(원본 사진 또는 펼친 면 사진)와 확대 영역.

import { describe, expect, it } from "vitest";
import type { CheckpointMedia, Inspection } from "../../../shared/api/types";
import { candidateShots, cropBox } from "./candidateShots";
import { reviewGroups } from "./review";

// 테스트 도구: 윗면 CAM1 사진 위 AI 후보 하나(조명·확신도)를 만든다.
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

// 테스트 도구: 같은 흠집이 L1(0.3)·L2(0.6) 사진에 잡힌 빠른 검사 결과.
const quick = { profile: "QUICK", defects: [], photoDefects: [pd("a", "L1", 0.3), pd("b", "L2", 0.6)] } as unknown as Inspection;
// 테스트 도구: 윗면 L1·L2 원본 사진 주소와 펼친 윗면 그림 주소.
const media = {
  photos: [
    { face: "TOP", camera: "CAM1", light: "L1", url: "https://x/l1.jpg" },
    { face: "TOP", camera: "CAM1", light: "L2", url: "https://x/l2.jpg" },
  ],
  textures: [{ face: "TOP", url: "https://x/top.jpg" }],
  crops: [],
} as unknown as CheckpointMedia;

describe("검수 후보 카드 사진", () => {
  // [상황] 빠른 검사 후보 카드에 보일 사진을 고른다.
  // [기대] 후보가 잡힌 원본 사진을 확신도 높은 순(L2 → L1)으로 보인다.
  it("빠른 검사 후보는 잡힌 원본 사진을 신뢰도 높은 순으로 보인다", () => {
    const [group] = reviewGroups(quick);
    const shots = candidateShots(group, quick, media);
    expect(shots.map((s) => s.src)).toEqual(["https://x/l2.jpg", "https://x/l1.jpg"]);
    expect(shots[0].light).toBe("L2");
  });

  // [상황] 전체 검사 후보가 펼친 면 좌표만 있고 원본 사진 위치는 없다.
  // [기대] 펼친 윗면 그림 위에 보이고 카메라 정보는 없다.
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

  // [상황] 사진 목록을 아직 못 받았다.
  // [기대] 빈 목록이다.
  it("사진 목록이 없으면 빈 목록", () => {
    const [group] = reviewGroups(quick);
    expect(candidateShots(group, quick, null)).toEqual([]);
  });

  // [상황] 작은 후보와 사진 거의 전체를 덮는 후보의 확대 영역을 정한다.
  // [기대] 후보를 감싸는 4:3 영역이고 사진 밖으로 나가지 않는다.
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

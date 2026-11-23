// 이 파일이 확인하는 것: 3D 노트북 모델 위에 흠집 모양을 올리는 좌표 계산. MacBook Air M2 치수로 시험한다.

import { describe, expect, it } from "vitest";
import { faceRatio } from "./faces";
import { facePlanes, photoShapePoints, standardFaceSize, standardShapePoints } from "./shapes";

const DIMS = { widthMm: 304.1, depthMm: 215, baseHMm: 7.5, lidHMm: 3.8 };

describe("3D 흠집 모양 좌표", () => {
  // [상황] 펼친 면(400×200px) 위 흠집 모양을 면 좌표로 바꾼다. 면 크기를 모르는 경우도 넣는다.
  // [기대] 면 크기로 나눠 0~1 좌표가 되고, 면 크기를 모르면 바꾸지 않는다(null).
  it("표준 좌표 폴리곤은 면 이미지 크기로 나눠 면 좌표(0~1)가 된다", () => {
    expect(standardShapePoints([[100, 50], [200, 100]], { width: 400, height: 200 })).toEqual([[0.25, 0.25], [0.5, 0.5]]);
    expect(standardShapePoints([[1, 1]], undefined)).toBeNull();
  });

  // [상황] 윗면·왼쪽 옆면의 펼친 그림 크기를 모른다.
  // [기대] 기종 치수 × 4px/mm로 잡는다(옆면 세로는 본체 + 덮개 두께).
  it("표준 좌표 면 크기를 모르면 치수 × 4 px/mm로 잡는다", () => {
    expect(standardFaceSize("TOP", DIMS)).toEqual({ width: 304.1 * 4, height: 215 * 4 });
    expect(standardFaceSize("SL", DIMS)).toEqual({ width: 215 * 4, height: (7.5 + 3.8) * 4 });
  });

  // [상황] 부스 CAM1 윗면 사진 한가운데 흠집을 3D 면 위로 옮긴다.
  // [기대] 카메라별 네 모서리 보정 규칙으로 옮겨지고, 면 가운데 근처(0.4~0.6)에 놓인다.
  it("부스 사진 px 폴리곤은 카메라별 네 모서리 규칙(faceRatio)으로 옮긴다", () => {
    const size = { width: 1920, height: 1080 };
    const [[u, v]] = photoShapePoints("TOP", "CAM1", [[960, 540]], size);
    expect([u, v]).toEqual(Object.values(faceRatio("TOP", "CAM1", [960, 540], size)));
    expect(u).toBeGreaterThan(0.4);
    expect(u).toBeLessThan(0.6);
  });

  // [상황] 앞 옆면(SF)을 3D에 붙일 판으로 만든다.
  // [기대] 본체·덮개 두 판으로 나뉘고, 각 판은 세로 방향으로만 펼쳐지며 높이가 본체 7.5mm·덮개 3.8mm다(경계에서 흠집이 반대쪽으로 새지 않음).
  it("옆면 판은 본체·덮개 둘로 나뉘고, 각 판은 그 부분 면에 붙어 있다(경계에서 반대쪽으로 새지 않음)", () => {
    const planes = facePlanes("SF", DIMS);
    expect(planes.map((p) => p.part)).toEqual(["base", "lid"]);
    for (const p of planes) {
      // 앞 옆면 판은 z 방향으로 펼쳐지지 않는다(세로는 y축만)
      expect(Math.abs(p.upAxis[2])).toBeLessThan(1e-3);
      expect(p.upAxis[1]).toBeGreaterThan(0);
    }
    expect(planes[0].upAxis[1]).toBeCloseTo(7.5, 3);
    expect(planes[1].upAxis[1]).toBeCloseTo(3.8, 3);
  });
});

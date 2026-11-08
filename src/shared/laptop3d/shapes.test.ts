import { describe, expect, it } from "vitest";
import { facePlanes, photoShapePoints, standardFaceSize, standardShapePoints } from "./shapes";

const DIMS = { widthMm: 304.1, depthMm: 215, baseHMm: 7.5, lidHMm: 3.8 };

describe("3D 흠집 모양 좌표", () => {
  it("표준 좌표 폴리곤은 면 이미지 크기로 나눠 면 좌표(0~1)가 된다", () => {
    expect(standardShapePoints([[100, 50], [200, 100]], { width: 400, height: 200 })).toEqual([[0.25, 0.25], [0.5, 0.5]]);
    expect(standardShapePoints([[1, 1]], undefined)).toBeNull();
  });

  it("표준 좌표 면 크기를 모르면 치수 × 4 px/mm로 잡는다", () => {
    expect(standardFaceSize("TOP", DIMS)).toEqual({ width: 304.1 * 4, height: 215 * 4 });
    expect(standardFaceSize("SL", DIMS)).toEqual({ width: 215 * 4, height: (7.5 + 3.8) * 4 });
  });

  it("부스 사진 px 폴리곤은 카메라 반쪽 규칙(faceRatio)으로 옮긴다", () => {
    const [[u, v]] = photoShapePoints("TOP", "CAM1", [[960, 540]], { width: 1920, height: 1080 });
    expect(u).toBeCloseTo(0.5);
    expect(v).toBeCloseTo(0.75);
  });

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

// 이 파일이 확인하는 것: 관리자가 놓친 흠집을 사진 위에 직접 그릴 때(11/9) 그린 것을 흠집 모양(다각형)으로 바꾸는 규칙.
// 점 찍기, 테두리 그리기, 선 긋기 세 방법이 있다.

import { area, MAX_POINTS, pathPolygon, pointPolygon, pointRadius, strokePolygon } from "./draw";

// [상황] 1920×1080 사진의 왼쪽 끝 가까이에 점을 찍는다.
// [기대] 사진 긴 변의 1.2%(23px) 반지름 12각형이 되고, 사진 밖으로 나간 꼭짓점은 가장자리(0)에 붙는다.
test("점 표시는 사진 긴 변의 1.2% 반지름 12각형이고, 사진 밖 꼭짓점은 가장자리로 붙는다", () => {
  expect(pointRadius(1920, 1080)).toBe(23);
  expect(pointRadius(200, 100)).toBe(8);
  const poly = pointPolygon(5, 500, 23, 1920, 1080);
  expect(poly).toHaveLength(12);
  expect(Math.min(...poly.map(([x]) => x))).toBe(0);
  expect(area(poly)).toBeGreaterThan(0);
});

// [상황] 점 1000개로 원을 따라 그리고, 너무 짧게 그리거나 일직선으로 그린다.
// [기대] 원은 200개 이하 꼭짓점으로 줄여 넓이가 있는 모양이 되고, 넓이가 없는 그림은 흠집으로 만들지 않는다(null).
test("테두리 그리기는 가까운 점을 버리고 200개 이하로 줄이며, 넓이가 없으면 null", () => {
  const circle = Array.from({ length: 1000 }, (_, i) => [500 + 100 * Math.cos((i / 1000) * 2 * Math.PI), 400 + 100 * Math.sin((i / 1000) * 2 * Math.PI)]);
  const poly = pathPolygon(circle, 1920, 1080);
  expect(poly).not.toBeNull();
  expect(poly!.length).toBeLessThanOrEqual(MAX_POINTS);
  expect(area(poly!)).toBeGreaterThan(30000);
  expect(pathPolygon([[1, 1], [1.5, 1.2]], 100, 100)).toBeNull();
  expect(pathPolygon([[0, 0], [10, 10], [20, 20]], 100, 100)).toBeNull();
});

// [상황] 가로로 곧은 선을 두께 6으로 긋는다.
// [기대] 선 양옆으로 두껍게 한 띠 모양(높이 약 12px)이 되고 꼭짓점은 200개 이하다(긁힘을 선으로 그릴 때).
test("선 긋기는 선을 양옆으로 두껍게 한 띠 다각형이 된다", () => {
  const line = Array.from({ length: 50 }, (_, i) => [100 + i * 4, 300]);
  const band = strokePolygon(line, 6, 1920, 1080);
  expect(band).not.toBeNull();
  const ys = band!.map(([, y]) => y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(12, 0);
  expect(band!.length).toBeLessThanOrEqual(MAX_POINTS);
});

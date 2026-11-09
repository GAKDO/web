import { area, MAX_POINTS, pathPolygon, pointPolygon, pointRadius, strokePolygon } from "./draw";

test("점 표시는 사진 긴 변의 1.2% 반지름 12각형이고, 사진 밖 꼭짓점은 가장자리로 붙는다", () => {
  expect(pointRadius(1920, 1080)).toBe(23);
  expect(pointRadius(200, 100)).toBe(8);
  const poly = pointPolygon(5, 500, 23, 1920, 1080);
  expect(poly).toHaveLength(12);
  expect(Math.min(...poly.map(([x]) => x))).toBe(0);
  expect(area(poly)).toBeGreaterThan(0);
});

test("테두리 그리기는 가까운 점을 버리고 200개 이하로 줄이며, 넓이가 없으면 null", () => {
  const circle = Array.from({ length: 1000 }, (_, i) => [500 + 100 * Math.cos((i / 1000) * 2 * Math.PI), 400 + 100 * Math.sin((i / 1000) * 2 * Math.PI)]);
  const poly = pathPolygon(circle, 1920, 1080);
  expect(poly).not.toBeNull();
  expect(poly!.length).toBeLessThanOrEqual(MAX_POINTS);
  expect(area(poly!)).toBeGreaterThan(30000);
  expect(pathPolygon([[1, 1], [1.5, 1.2]], 100, 100)).toBeNull();
  expect(pathPolygon([[0, 0], [10, 10], [20, 20]], 100, 100)).toBeNull();
});

test("선 긋기는 선을 양옆으로 두껍게 한 띠 다각형이 된다", () => {
  const line = Array.from({ length: 50 }, (_, i) => [100 + i * 4, 300]);
  const band = strokePolygon(line, 6, 1920, 1080);
  expect(band).not.toBeNull();
  const ys = band!.map(([, y]) => y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(12, 0);
  expect(band!.length).toBeLessThanOrEqual(MAX_POINTS);
});

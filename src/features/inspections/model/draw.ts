// 놓친 흠집 직접 표시(11/9): 관리자가 원본 사진 위에 점을 찍거나 따라 그린 자국을 계약 HumanDefectRequest.polygon(원본 px)으로 바꾼다.

/** 계약 maxItems. 따라 그린 점이 많으면 이 수 안으로 줄인다 */
export const MAX_POINTS = 200;

/** 점 표시를 다각형으로 바꿀 때 꼭짓점 수 */
const POINT_SIDES = 12;

/** 점 표시 반지름: 사진 긴 변의 1.2%(1920px 사진이면 약 23px), 최소 8px */
export function pointRadius(width: number, height: number): number {
  return Math.max(8, Math.round(Math.max(width, height) * 0.012));
}

/** 사진 밖으로 나간 좌표를 사진 안(0~크기)으로 */
const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);

const round = (v: number) => Math.round(v * 10) / 10;

/** 점 하나를 작은 원(12각형) 다각형으로. 사진 밖으로 나간 꼭짓점은 사진 가장자리로 붙인다 */
export function pointPolygon(x: number, y: number, radius: number, width: number, height: number): number[][] {
  return Array.from({ length: POINT_SIDES }, (_, i) => {
    const a = (2 * Math.PI * i) / POINT_SIDES;
    return [round(clamp(x + radius * Math.cos(a), width)), round(clamp(y + radius * Math.sin(a), height))];
  });
}

/**
 * 따라 그린 자취를 다각형으로: 사진 안으로 붙이고, 앞 점과 minGap px보다 가까운 점은 버리고, 그래도 많으면 고르게 솎아 MAX_POINTS 이하로.
 * 꼭짓점이 3개가 안 되면 null(점 표시로 바꾸라는 뜻)
 */
export function pathPolygon(path: number[][], width: number, height: number, minGap = 2): number[][] | null {
  const kept: number[][] = [];
  for (const [x, y] of path) {
    const p = [round(clamp(x, width)), round(clamp(y, height))];
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minGap) kept.push(p);
  }
  const thinned = kept.length > MAX_POINTS ? Array.from({ length: MAX_POINTS }, (_, i) => kept[Math.floor((i * kept.length) / MAX_POINTS)]) : kept;
  return thinned.length >= 3 && area(thinned) >= 4 ? thinned : null;
}

/** 다각형 넓이(px²). 한 줄로 그어 넓이가 거의 없으면 다각형으로 보지 않는다 */
export function area(polygon: number[][]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** 길쭉한 긁힘을 한 줄로 그었을 때: 선을 양옆 halfWidth px로 두껍게 한 띠 다각형(정방향 + 역방향) */
export function strokePolygon(path: number[][], halfWidth: number, width: number, height: number): number[][] | null {
  const line = pathPolygon(path, width, height, Math.max(2, halfWidth / 2));
  const points = line ?? path.map(([x, y]) => [round(clamp(x, width)), round(clamp(y, height))]);
  if (points.length < 2) return null;
  const left: number[][] = [];
  const right: number[][] = [];
  const step = Math.max(1, Math.ceil(points.length / (MAX_POINTS / 2)));
  for (let i = 0; i < points.length; i += step) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * halfWidth;
    const ny = (dx / len) * halfWidth;
    const [x, y] = points[i];
    left.push([round(clamp(x + nx, width)), round(clamp(y + ny, height))]);
    right.push([round(clamp(x - nx, width)), round(clamp(y - ny, height))]);
  }
  const band = [...left, ...right.reverse()];
  return band.length >= 3 && area(band) >= 4 ? band.slice(0, MAX_POINTS) : null;
}

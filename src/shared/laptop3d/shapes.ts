import type { CaptureCamera, CaptureFace, ModelDimensions } from "../api/types";
import { faceRatio, placeOnLaptop, type Size, type Vec3 } from "./faces";

// 실제 탐지된 흠집 모양을 3D 모델 면 위에 그리기 위한 계산(11/8 민서 요청).
// 핀(점) 대신 서버가 돌려준 폴리곤 모양 그대로를 면 좌표(u, v)로 옮겨 그 면에 붙인 투명 판에 그린다.
// 모양을 만들어 내지 않는다: 서버 폴리곤이 없으면 아무것도 그리지 않는다.

/** 면 위의 흠집 모양 하나. points는 면 좌표(0~1, 왼쪽 위가 0,0) */
export interface FaceShape {
  id: string;
  face: CaptureFace;
  points: [number, number][];
  /** 채우기·테두리 색 */
  color: string;
  /** 눈에 띄게(신규·선택) — 테두리를 굵게, 둘레 고리를 진하게 */
  emphasis?: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 표준 좌표(펼친 면 px) 폴리곤 → 면 좌표. 크기를 모르면 null */
export function standardShapePoints(polygon: number[][], size: Size | undefined): [number, number][] | null {
  if (!size || size.width <= 0 || size.height <= 0 || polygon.length === 0) return null;
  return polygon.map((p) => [clamp01((p[0] ?? 0) / size.width), clamp01((p[1] ?? 0) / size.height)]);
}

/** 원본 사진 px 폴리곤(부스 카메라) → 면 좌표. 점마다 faceRatio로 옮긴다(공개 상세 핀과 같은 규칙) */
export function photoShapePoints(face: CaptureFace, camera: CaptureCamera, polygon: number[][], size: Size): [number, number][] {
  return polygon.map((p) => {
    const { u, v } = faceRatio(face, camera, [p[0] ?? 0, p[1] ?? 0], size);
    return [u, v];
  });
}

/**
 * 표준 좌표 면 이미지 크기(px). 텍스처를 아직 못 읽었을 때 쓴다.
 * 표준 좌표는 1 px = 0.25 mm(contracts capture/faces.md)라 면의 mm 크기 × 4다
 */
export function standardFaceSize(face: CaptureFace, d: ModelDimensions): Size {
  const H = d.baseHMm + d.lidHMm;
  const mm: Record<CaptureFace, [number, number]> = {
    TOP: [d.widthMm, d.depthMm],
    KB: [d.widthMm, d.depthMm],
    BOT: [d.widthMm, d.depthMm],
    SCR0: [d.widthMm, d.depthMm],
    SCR1: [d.widthMm, d.depthMm],
    SF: [d.widthMm, H],
    SB: [d.widthMm, H],
    SL: [d.depthMm, H],
    SR: [d.depthMm, H],
  };
  const [w, h] = mm[face];
  return { width: w * 4, height: h * 4 };
}

/** 면 위의 판 하나(본체 또는 덮개 좌표). 옆면은 본체·덮개 두 판으로 나뉜다 */
export interface FacePlane {
  face: CaptureFace;
  part: "base" | "lid";
  /** 이 판이 덮는 면 좌표 v 범위(옆면만 0~1의 일부) */
  v0: number;
  v1: number;
  /** 판 중심(mm, 그 부분 좌표) */
  center: Vec3;
  /** u가 늘어나는 방향(길이 = 판 너비 mm) */
  uAxis: Vec3;
  /** 화면 위쪽(v가 줄어드는 방향, 길이 = 판 높이 mm) */
  upAxis: Vec3;
  normal: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** 면 좌표 사각형(u 0~1, v v0~v1)을 그 면에 붙는 판으로 */
function planeOf(face: CaptureFace, d: ModelDimensions, v0: number, v1: number): FacePlane {
  const at = (u: number, v: number) => placeOnLaptop(face, { u, v }, d);
  // 본체·덮개 경계(v = share)에서 부동소수 오차로 반대쪽 부분에 떨어지지 않게 끝점은 아주 조금 안쪽에서 잰다
  const e = 1e-6;
  const mid = at(0.5, (v0 + v1) / 2);
  return {
    face,
    part: mid.part,
    v0,
    v1,
    center: mid.position,
    uAxis: sub(at(1, v0 + e).position, at(0, v0 + e).position),
    upAxis: sub(at(0, v0 + e).position, at(0, v1 - e).position),
    normal: mid.normal,
  };
}

/** 면 하나에 붙일 판들. 옆면은 닫힌 상태 사진이라 아래(본체)·위(덮개 옆 모서리)로 나눈다 */
export function facePlanes(face: CaptureFace, d: ModelDimensions): FacePlane[] {
  const side = face === "SF" || face === "SB" || face === "SL" || face === "SR";
  if (!side) return [planeOf(face, d, 0, 1)];
  const total = d.baseHMm + d.lidHMm;
  const share = total > 0 ? d.lidHMm / total : 0; // 위쪽(v 0~share)이 덮개
  const planes = [planeOf(face, d, share, 1)];
  if (share > 0) planes.push(planeOf(face, d, 0, share));
  return planes;
}

/** 면 이미지의 가로:세로(mm). 그림판 크기를 정할 때 쓴다 */
export function faceAspect(face: CaptureFace, d: ModelDimensions): number {
  const s = standardFaceSize(face, d);
  return s.width / s.height;
}

/** 폴리곤을 감싸는 사각형(면 좌표) */
export function shapeBounds(points: [number, number][]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * 한 면의 흠집 모양을 그림판에 그린다(배경 투명). 실제 폴리곤을 채우고 테두리를 두르며,
 * 아주 작은 흠집도 멀리서 찾을 수 있게 둘레에 옅은 고리를 그린다. 고리는 위치 표시일 뿐 흠집 크기가 아니다
 */
export function paintFace(ctx: CanvasRenderingContext2D, width: number, height: number, shapes: FaceShape[]): void {
  ctx.clearRect(0, 0, width, height);
  const unit = Math.max(width, height) / 1024;
  for (const s of shapes) {
    if (s.points.length === 0) continue;
    const pts = s.points.map(([u, v]) => [u * width, v * height] as const);
    const b = shapeBounds(s.points);
    const cx = ((b.x0 + b.x1) / 2) * width;
    const cy = ((b.y0 + b.y1) / 2) * height;
    const span = Math.hypot((b.x1 - b.x0) * width, (b.y1 - b.y0) * height);
    // 둘레 고리
    ctx.beginPath();
    ctx.arc(cx, cy, span / 2 + 16 * unit, 0, Math.PI * 2);
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.emphasis ? 0.9 : 0.5;
    ctx.lineWidth = (s.emphasis ? 3 : 2) * unit;
    ctx.stroke();
    // 흠집 모양(폴리곤). 점이 하나뿐이거나 아주 작으면 작은 점으로
    ctx.beginPath();
    if (pts.length < 3 || span < 3 * unit) {
      ctx.arc(cx, cy, 3 * unit, 0, Math.PI * 2);
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineJoin = "round";
    ctx.lineWidth = (s.emphasis ? 2.5 : 1.75) * unit;
    ctx.strokeStyle = s.color;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

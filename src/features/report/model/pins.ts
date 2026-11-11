import type { CaptureFace, Pin } from "../../../shared/api/types";

// 핀(펼친 면 px) → 3D 위치(FR-011). 텍스처와 핀은 같은 표준 좌표 이미지다(1 px = 0.25 mm).
// 면별 방향은 contracts capture/faces.md를 따른다. 표가 바뀌면 이 파일과 TwinViewer의 텍스처 방향만 고친다.

export interface Dimensions {
  widthMm: number;
  depthMm: number;
  baseHMm: number;
  lidHMm: number;
}

export interface TextureSize {
  width: number;
  height: number;
}

/** 화면 상자 안쪽에는 SCR0을 먼저 입히고, 없으면 SCR1 */
export function lidInnerFace(available: CaptureFace[]): CaptureFace | null {
  if (available.includes("SCR0")) return "SCR0";
  if (available.includes("SCR1")) return "SCR1";
  return null;
}

/** 면 위의 비율 위치(0~1, 왼쪽 위가 0,0). 범위를 벗어나거나 크기를 모르면 null(그 핀은 그리지 않음) */
export function pinRatio(pin: Pin, size: TextureSize | undefined): { u: number; v: number } | null {
  if (!size || size.width <= 0 || size.height <= 0) return null;
  const u = pin.x / size.width;
  const v = pin.y / size.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

export type Vec3 = [number, number, number];

/** 옆면(SF·SB·SL·SR) 사진은 닫힌 상태로 찍어 세로가 본체+덮개 높이다(contracts capture/faces.md). 아래 몇 비율이 본체인지 */
export function sideBaseShare(d: Dimensions): number {
  const total = d.baseHMm + d.lidHMm;
  return total > 0 ? d.baseHMm / total : 1;
}

/** 덮개 위 점: 닫힌 덮개에서 경첩(뒤 윗모서리)으로부터 앞쪽 거리 s, 본체 윗면에서 위로 t. x축으로 openDeg 돌린다 */
function lidPoint(x: number, s: number, t: number, d: Dimensions, openDeg: number): Vec3 {
  const a = (openDeg * Math.PI) / 180;
  return [x, d.baseHMm / 2 + s * Math.sin(a) + t * Math.cos(a), -d.depthMm / 2 + s * Math.cos(a) - t * Math.sin(a)];
}

/** 닫힌 덮개 기준 방향(dy, dz)을 연 상태로 돌린다 */
function lidDir(dx: number, dy: number, dz: number, openDeg: number): Vec3 {
  const a = (openDeg * Math.PI) / 180;
  // 닫힌 덮개의 +z(앞)는 (0, sin, cos), +y(위)는 (0, cos, −sin)로 간다
  return [dx, dz * Math.sin(a) + dy * Math.cos(a), dz * Math.cos(a) - dy * Math.sin(a)];
}

export interface Placement {
  position: Vec3;
  /** 면의 바깥 방향(단위 벡터). 핀을 면 위로 띄우고 신규 고리를 면에 눕히는 데 쓴다 */
  normal: Vec3;
}

/**
 * 펼친 면의 비율 위치 → 모델 좌표(mm, 본체 중심이 원점, x 오른쪽, y 위, z 앞).
 * 면별 방향은 contracts capture/faces.md: 이미지는 그 면을 바깥에서 본 모습, 원점은 왼쪽 위.
 */
export function pinPlacement(face: CaptureFace, ratio: { u: number; v: number }, d: Dimensions, openDeg = 110): Placement {
  const { u, v } = ratio;
  const W = d.widthMm;
  const D = d.depthMm;
  const halfH = d.baseHMm / 2;
  switch (face) {
    case "KB": // 위에서, 위쪽 = 뒤, 왼쪽 = 사용자 왼쪽
      return { position: [(u - 0.5) * W, halfH, (v - 0.5) * D], normal: [0, 1, 0] };
    case "BOT": // 아래에서, 위쪽 = 뒤, 왼쪽 = 사용자 오른쪽
      return { position: [(0.5 - u) * W, -halfH, (v - 0.5) * D], normal: [0, -1, 0] };
    case "TOP": // 닫힌 덮개를 위에서, 위쪽 = 뒤(경첩), 왼쪽 = 사용자 왼쪽
      return { position: lidPoint((u - 0.5) * W, v * D, d.lidHMm, d, openDeg), normal: lidDir(0, 1, 0, openDeg) };
    case "SCR0":
    case "SCR1": // 연 화면을 앞에서, 위쪽 = 화면 위 모서리(경첩 반대쪽), 왼쪽 = 사용자 왼쪽
      return { position: lidPoint((u - 0.5) * W, (1 - v) * D, 0, d, openDeg), normal: lidDir(0, -1, 0, openDeg) };
    case "SF":
    case "SB":
    case "SL":
    case "SR": {
      // 닫힌 상태 옆면: 아래쪽은 본체, 위쪽은 덮개 옆 모서리. 본체 윗면에서 잰 높이 h(음수면 본체)
      const h = (1 - v) * (d.baseHMm + d.lidHMm) - d.baseHMm;
      const side: Record<"SF" | "SB" | "SL" | "SR", { x: number; s: number; n: [number, number, number] }> = {
        SF: { x: (u - 0.5) * W, s: D, n: [0, 0, 1] }, // 왼쪽 = 사용자 왼쪽
        SB: { x: (0.5 - u) * W, s: 0, n: [0, 0, -1] }, // 왼쪽 = 사용자 오른쪽
        SL: { x: -W / 2, s: u * D, n: [-1, 0, 0] }, // 왼쪽 = 뒤
        SR: { x: W / 2, s: (1 - u) * D, n: [1, 0, 0] }, // 왼쪽 = 앞
      };
      const { x, s, n } = side[face];
      if (h <= 0) return { position: [x, halfH + h, s - D / 2], normal: n };
      return { position: lidPoint(x, s, h, d, openDeg), normal: lidDir(n[0], n[1], n[2], openDeg) };
    }
  }
}

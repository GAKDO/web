import type { CaptureFace, Pin } from "../../../shared/api/types";

// 핀(펼친 면 px) → 3D 위치(FR-011). 텍스처와 핀은 같은 펼친 면 좌표라고 본다(plan "핀 위치").
// 면 대응이 ML2와 다르면 이 파일만 고친다.

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

/** 3D 모델의 면 이름. 본체(base)·화면 상자(lid)의 여섯 면 */
export type BoxSide = "base.top" | "base.bottom" | "base.front" | "base.back" | "base.left" | "base.right" | "lid.outer" | "lid.inner";

export const FACE_TO_SIDE: Record<CaptureFace, BoxSide> = {
  TOP: "lid.outer",
  SCR0: "lid.inner",
  SCR1: "lid.inner",
  KB: "base.top",
  BOT: "base.bottom",
  SF: "base.front",
  SB: "base.back",
  SL: "base.left",
  SR: "base.right",
};

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

/** 모델 좌표(mm, 본체 중심이 원점, y 위, z 앞). 화면 상자는 경첩(뒤 윗모서리)에서 openDeg만큼 연다 */
export function pinPosition(face: CaptureFace, ratio: { u: number; v: number }, d: Dimensions, openDeg = 110): [number, number, number] {
  const { u, v } = ratio;
  const x = (u - 0.5) * d.widthMm;
  const halfH = d.baseHMm / 2;
  const halfD = d.depthMm / 2;
  switch (FACE_TO_SIDE[face]) {
    case "base.top":
      return [x, halfH, (v - 0.5) * d.depthMm];
    case "base.bottom":
      return [x, -halfH, (0.5 - v) * d.depthMm];
    case "base.front":
      return [x, (0.5 - v) * d.baseHMm, halfD];
    case "base.back":
      return [-x, (0.5 - v) * d.baseHMm, -halfD];
    case "base.left":
      return [-d.widthMm / 2, (0.5 - v) * d.baseHMm, (u - 0.5) * d.depthMm];
    case "base.right":
      return [d.widthMm / 2, (0.5 - v) * d.baseHMm, (0.5 - u) * d.depthMm];
    case "lid.outer":
    case "lid.inner": {
      // 닫힌 덮개에서 경첩(뒤 윗모서리)으로부터 앞쪽 거리 s, 위쪽 두께 t를 구하고 x축으로 openDeg 돌린다.
      // 화면 사진은 위쪽(v=0)이 경첩에서 먼 쪽, 덮개 겉면 사진은 위쪽이 경첩 쪽이다
      const inner = FACE_TO_SIDE[face] === "lid.inner";
      const s = (inner ? 1 - v : v) * d.depthMm;
      const t = inner ? 0 : d.lidHMm;
      const angle = (openDeg * Math.PI) / 180;
      return [x, halfH + s * Math.sin(angle) + t * Math.cos(angle), -halfD + s * Math.cos(angle) - t * Math.sin(angle)];
    }
  }
}

/** 면의 바깥 방향(단위 벡터). 핀을 면 위로 살짝 띄우고 신규 고리를 면에 눕히는 데 쓴다 */
export function faceNormal(face: CaptureFace, openDeg = 110): [number, number, number] {
  const a = (openDeg * Math.PI) / 180;
  switch (FACE_TO_SIDE[face]) {
    case "base.top":
      return [0, 1, 0];
    case "base.bottom":
      return [0, -1, 0];
    case "base.front":
      return [0, 0, 1];
    case "base.back":
      return [0, 0, -1];
    case "base.left":
      return [-1, 0, 0];
    case "base.right":
      return [1, 0, 0];
    case "lid.outer":
      return [0, Math.cos(a), -Math.sin(a)];
    case "lid.inner":
      return [0, -Math.cos(a), Math.sin(a)];
  }
}

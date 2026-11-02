import type { CaptureFace } from "../../shared/api/types";

// 폰 안에서 하는 흔들림·반사 검사(WE2 FR-011·012, research R2). 기준값은 여기서만 바꾼다.
export const BLUR_MIN = 60;
export const GLARE_LEVEL = 250;
export const GLARE_MAX = 0.03;
/** 검사용으로 줄일 긴 변(px) */
export const CHECK_SIZE = 512;

export interface Gray {
  width: number;
  height: number;
  /** 밝기 0~255, 길이 width × height */
  data: Uint8ClampedArray;
}

export type QualityReason = "BLUR" | "GLARE";

export interface QualityResult {
  ok: boolean;
  reason: QualityReason | null;
  blurScore: number;
  glareRatio: number;
}

/** RGBA 픽셀을 밝기로 바꾼다(BT.601) */
export function toGray(rgba: { width: number; height: number; data: Uint8ClampedArray }): Gray {
  const data = new Uint8ClampedArray(rgba.width * rgba.height);
  for (let i = 0; i < data.length; i++) {
    const o = i * 4;
    data[i] = 0.299 * rgba.data[o] + 0.587 * rgba.data[o + 1] + 0.114 * rgba.data[o + 2];
  }
  return { width: rgba.width, height: rgba.height, data };
}

/** 라플라시안(4-이웃) 분산. 낮을수록 흐리다 */
export function blurScore({ width, height, data }: Gray): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = data[i - 1] + data[i + 1] + data[i - width] + data[i + width] - 4 * data[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** 거의 하얗게 날아간 픽셀의 비율 */
export function glareRatio({ data }: Gray): number {
  if (data.length === 0) return 0;
  let bright = 0;
  for (const v of data) if (v >= GLARE_LEVEL) bright++;
  return bright / data.length;
}

/** SCR1(흰 화면)은 원래 밝아 반사 검사를 하지 않고, 흔들림 기준을 절반으로 둔다 */
export function checkQuality(gray: Gray, face: CaptureFace): QualityResult {
  const blur = blurScore(gray);
  const glare = glareRatio(gray);
  const whiteScreen = face === "SCR1";
  const blurMin = whiteScreen ? BLUR_MIN / 2 : BLUR_MIN;
  const reason: QualityReason | null = blur < blurMin ? "BLUR" : !whiteScreen && glare > GLARE_MAX ? "GLARE" : null;
  return { ok: reason === null, reason, blurScore: Math.round(blur), glareRatio: Math.round(glare * 1000) / 1000 };
}

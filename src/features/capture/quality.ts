import type { CaptureFace } from "../../shared/api/types";

// 폰 안에서 하는 흔들림·반사 검사(WE2 FR-011·012, research R2). 기준값은 여기서만 바꾼다.
export const BLUR_MIN = 60;
export const GLARE_LEVEL = 250;
export const GLARE_MAX = 0.03;
/** 평균 밝기가 이보다 낮으면 너무 어둡다(0~255). 검은 노트북도 실내 조명이면 이보다 밝게 찍힌다 */
export const DARK_MEAN = 40;
/** 찍기 전 안내: 앞뒤 프레임 밝기 차이(칸 평균)가 이보다 크면 폰이 움직이는 중이다 */
export const MOVE_DIFF = 14;
/** 검사용으로 줄일 긴 변(px) */
export const CHECK_SIZE = 512;

export interface Gray {
  width: number;
  height: number;
  /** 밝기 0~255, 길이 width × height */
  data: Uint8ClampedArray;
}

export type QualityReason = "DARK" | "BLUR" | "GLARE";

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

/** 평균 밝기(0~255) */
export function meanBrightness({ data }: Gray): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (const v of data) sum += v;
  return sum / data.length;
}

/** SCR1(흰 화면)은 원래 밝아 반사 검사를 하지 않고, 흔들림 기준을 절반으로 둔다 */
export function checkQuality(gray: Gray, face: CaptureFace): QualityResult {
  const blur = blurScore(gray);
  const glare = glareRatio(gray);
  const whiteScreen = face === "SCR1";
  const blurMin = whiteScreen ? BLUR_MIN / 2 : BLUR_MIN;
  // 어두우면 흔들림 점수도 낮게 나오므로, 고칠 방법이 분명한 "어두움"을 먼저 알린다(11/11, 4팀 촬영 안내 참고)
  const reason: QualityReason | null =
    meanBrightness(gray) < DARK_MEAN ? "DARK" : blur < blurMin ? "BLUR" : !whiteScreen && glare > GLARE_MAX ? "GLARE" : null;
  return { ok: reason === null, reason, blurScore: Math.round(blur), glareRatio: Math.round(glare * 1000) / 1000 };
}

/** 찍기 전 실시간 안내(11/11). 자동으로 찍지는 않고, 지금 찍으면 어떻게 나올지만 알려 준다 */
export type LiveHint = "DARK" | "GLARE" | "MOVING" | "OK";

/** 같은 크기의 두 프레임에서 칸 평균 밝기 차이. 크기가 다르면(폰을 돌림) 움직이는 중으로 본다 */
export function frameDiff(a: Gray, b: Gray): number {
  if (a.width !== b.width || a.height !== b.height || a.data.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]);
  return sum / a.data.length;
}

/** 작은 미리보기 프레임(prev = 바로 앞 프레임)으로 안내를 고른다. 어두움 → 반사 → 움직임 순 */
export function liveHint(frame: Gray, prev: Gray | null, face: CaptureFace): LiveHint {
  if (meanBrightness(frame) < DARK_MEAN) return "DARK";
  if (face !== "SCR1" && glareRatio(frame) > GLARE_MAX) return "GLARE";
  if (prev && frameDiff(frame, prev) > MOVE_DIFF) return "MOVING";
  return "OK";
}

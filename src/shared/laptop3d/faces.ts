import type { CaptureCamera, CaptureFace, ModelDimensions } from "../api/types";

// 노트북 면 좌표 ↔ 3D 좌표(11/8). 공개 기기 상세(catalog)와 리포트(report) 3D가 같은 규칙을 쓴다.
// 사진으로 3D를 복원하지 않고, 부스 카메라가 고정이라는 점을 써서 "어느 면의 어느 쯤"을 면 좌표로 옮긴다.
//
// 면 좌표(u, v)는 contracts capture/faces.md와 같다: 그 면을 바깥에서 본 모습, 왼쪽 위가 (0, 0).
// 윗면(TOP)·키보드(KB)·바닥(BOT)은 위쪽이 뒤(경첩), 옆면은 닫힌 상태 전체 높이(아래가 본체).

/** 사진 비율 좌표 한 점(0~1, 왼쪽 위가 0) */
export type FramePoint = [number, number];

/**
 * 사진 안에서 노트북 면의 네 모서리(사진 크기 비율). 사진에 보이는 그대로 왼쪽 위·오른쪽 위·오른쪽 아래·왼쪽 아래 순서.
 * 카메라가 조금 돌아가 있거나 기울어 있어 사각형이 아니므로 네 점 호모그래피로 옮긴다.
 */
export type FrameQuad = [FramePoint, FramePoint, FramePoint, FramePoint];

/**
 * 부스 위 카메라 2대의 면 모서리(11/9 보정). 두 카메라 모두 면 **전체**를 찍는다(앞 반·뒤 반으로 나뉘지 않는다).
 * 11/5~11/6 부스 사진(MB02·MB07·MB08·MB13 윗면·바닥 L1, 1920×1080)에서 기기마다 네 모서리를 재어 평균했다.
 * 기기별 모서리로 옮기면 같은 흠집의 CAM1·CAM2 위치 차이가 2~4mm, 평균 모서리로는 놓는 자리 차이 때문에 6~18mm 어긋난다.
 * 윗면 사진은 위쪽이 경첩(사과 로고가 거꾸로)이고, 바닥은 앞 모서리를 들어 뒤로 넘기므로 경첩이 사진 아래에 온다.
 * 키보드(펼친 상태)도 본체 바닥 자리가 같아 같은 모서리를 쓴다.
 * 부스를 다시 만들거나 카메라를 옮기면 면마다 사진 한 장씩 네 모서리를 다시 재서 이 값만 바꾼다(재는 방법은 web docs/pin-calibration.md).
 */
export const FRAME: Record<"CAM1" | "CAM2", FrameQuad> = {
  CAM1: [
    [0.159, 0.219],
    [0.78, 0.117],
    [0.792, 0.912],
    [0.215, 0.921],
  ],
  CAM2: [
    [0.233, 0.127],
    [0.89, 0.154],
    [0.844, 0.905],
    [0.255, 0.909],
  ],
};

/**
 * 옆면·화면 사진(책상 높이 옆면 카메라, 파일 이름은 CAM1)은 아직 실제 사진으로 재지 않았다.
 * 노트북이 사진 가운데 대부분을 채운다고 보고 면 전체로 옮긴다.
 */
export const SIDE_FRAME: FrameQuad = [
  [0.06, 0.08],
  [0.94, 0.08],
  [0.94, 0.92],
  [0.06, 0.92],
];

/** 원본 사진 크기를 모를 때(아직 안 읽힘) 쓰는 부스 카메라 기본 해상도(C920 1920×1080) */
export const DEFAULT_PHOTO_SIZE = { width: 1920, height: 1080 };

export interface Size {
  width: number;
  height: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 폴리곤 무게 중심(꼭짓점 평균). 작은 흠집이라 넓이 가중 중심과 거의 같다 */
export function centroid(polygon: number[][]): [number, number] {
  const n = polygon.length || 1;
  const sx = polygon.reduce((s, p) => s + (p[0] ?? 0), 0);
  const sy = polygon.reduce((s, p) => s + (p[1] ?? 0), 0);
  return [sx / n, sy / n];
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

/** 단위 사각형 (0,0)(1,0)(1,1)(0,1) → 네 모서리 호모그래피(Heckbert 닫힌 꼴) */
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: FrameQuad): Mat3 {
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function invert([a, b, c, d, e, f, g, h, i]: Mat3): Mat3 {
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det];
}

// 모서리 값은 상수라 역행렬을 한 번만 만든다
const cache = new Map<FrameQuad, Mat3>();
function photoToSquare(quad: FrameQuad): Mat3 {
  let m = cache.get(quad);
  if (!m) {
    m = invert(squareToQuad(quad));
    cache.set(quad, m);
  }
  return m;
}

/** 사진 비율 좌표 → 네 모서리 안의 비율 좌표(s 오른쪽, t 아래, 사진에 보이는 방향 그대로). 모서리 밖은 끝에 붙인다 */
export function quadRatio(quad: FrameQuad, x: number, y: number): { s: number; t: number } {
  const [a, b, c, d, e, f, g, h, i] = photoToSquare(quad);
  const w = g * x + h * y + i;
  return { s: clamp01((a * x + b * y + c) / w), t: clamp01((d * x + e * y + f) / w) };
}

const SIDE_FACES = new Set<CaptureFace>(["SF", "SB", "SL", "SR", "SCR0", "SCR1"]);

/**
 * 사진 위 점 → 면 좌표. 위 카메라(CAM1·CAM2)는 각자 면 전체를 찍으므로 카메라별 네 모서리로 옮긴다.
 * 바닥은 앞 모서리를 들어 뒤로 넘겨 찍어 사진이 표준 방향(경첩 위·사용자 오른쪽이 왼쪽)과 180° 돌아 있다.
 * 옆면·화면은 옆면 카메라 기본 영역, 폰·모르는 카메라는 사진 전체가 면이다
 */
export function faceRatio(face: CaptureFace, camera: CaptureCamera, point: [number, number], size: Size): { u: number; v: number } {
  const x = point[0] / size.width;
  const y = point[1] / size.height;
  if (camera !== "CAM1" && camera !== "CAM2") return { u: clamp01(x), v: clamp01(y) };
  const { s, t } = quadRatio(SIDE_FACES.has(face) ? SIDE_FRAME : FRAME[camera], x, y);
  if (face === "BOT") return { u: 1 - s, v: 1 - t };
  return { u: s, v: t };
}

export type Vec3 = [number, number, number];

/** 핀이 붙는 부분: 본체(base) 좌표는 본체 중심이 원점, 덮개(lid) 좌표는 경첩이 원점인 닫힌 자세(덮개를 열면 함께 돈다) */
export interface LocalPlacement {
  part: "base" | "lid";
  position: Vec3;
  normal: Vec3;
}

/**
 * 면 좌표 → 3D 위치(mm, x 오른쪽·y 위·z 앞). 덮개 쪽 점은 덮개 그룹 안 좌표라 덮개를 여닫아도 핀이 면에 붙어 있다.
 * 면 방향은 report/model/pins.ts(contracts capture/faces.md)와 같다
 */
export function placeOnLaptop(face: CaptureFace, { u, v }: { u: number; v: number }, d: ModelDimensions): LocalPlacement {
  const W = d.widthMm;
  const D = d.depthMm;
  const halfH = d.baseHMm / 2;
  switch (face) {
    case "KB":
      return { part: "base", position: [(u - 0.5) * W, halfH, (v - 0.5) * D], normal: [0, 1, 0] };
    case "BOT":
      return { part: "base", position: [(0.5 - u) * W, -halfH, (v - 0.5) * D], normal: [0, -1, 0] };
    case "TOP":
      return { part: "lid", position: [(u - 0.5) * W, d.lidHMm, v * D], normal: [0, 1, 0] };
    case "SCR0":
    case "SCR1":
      return { part: "lid", position: [(u - 0.5) * W, 0, (1 - v) * D], normal: [0, -1, 0] };
    default: {
      // 닫힌 상태 옆면: 아래쪽은 본체, 위쪽은 덮개 옆 모서리. h는 본체 윗면에서 잰 높이(음수면 본체)
      const h = (1 - v) * (d.baseHMm + d.lidHMm) - d.baseHMm;
      const side: Record<"SF" | "SB" | "SL" | "SR", { x: number; s: number; n: Vec3 }> = {
        SF: { x: (u - 0.5) * W, s: D, n: [0, 0, 1] },
        SB: { x: (0.5 - u) * W, s: 0, n: [0, 0, -1] },
        SL: { x: -W / 2, s: u * D, n: [-1, 0, 0] },
        SR: { x: W / 2, s: (1 - u) * D, n: [1, 0, 0] },
      };
      const { x, s, n } = side[face];
      if (h <= 0) return { part: "base", position: [x, halfH + h, s - D / 2], normal: n };
      return { part: "lid", position: [x, h, s], normal: n };
    }
  }
}

/** 기기 색상 이름 → 3D 몸체 색. 모르는 이름은 은색 */
export function bodyColor(color: string | null | undefined): string {
  const c = (color ?? "").replace(/\s+/g, "").toLowerCase();
  if (/미드나이트|midnight/.test(c)) return "#2f3542";
  if (/스페이스그레이|spacegray|spacegrey|그레이|gray|grey/.test(c)) return "#7a7d82";
  if (/스타라이트|starlight|골드|gold/.test(c)) return "#e3d8c6";
  if (/블랙|black/.test(c)) return "#26282c";
  if (/블루|blue/.test(c)) return "#4f6e8f";
  return "#c9ccd1";
}


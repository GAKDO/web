import type { CaptureCamera, CaptureFace, CatalogPhotoDefect, DefectClass, ModelDimensions } from "../../../shared/api/types";

// 부스 사진의 흠집(원본 사진 px) → 노트북 3D 모델 위의 핀(11/8 민서 요청).
// 사진으로 3D를 복원하지 않고, 부스 카메라가 고정이라는 점을 써서 "어느 면의 어느 쯤"을 면 좌표로 옮긴다.
// 정확한 mm 위치가 아니라 대략 위치다. 정확한 모양은 핀을 눌러 원본 사진에서 본다.
//
// 면 좌표(u, v)는 contracts capture/faces.md와 같다: 그 면을 바깥에서 본 모습, 왼쪽 위가 (0, 0).
// 윗면(TOP)·키보드(KB)·바닥(BOT)은 위쪽이 뒤(경첩), 옆면은 닫힌 상태 전체 높이(아래가 본체).

/** 사진 안에서 노트북 면이 차지하는 영역(사진 크기 비율). 부스 카메라 높이·화각을 바꾸면 이 값만 다시 잰다 */
export interface FrameRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * 부스 카메라 2대는 한 면을 앞 반(CAM1)·뒤 반(CAM2)으로 나눠 찍는다(codes 라벨 "CAM1 앞 반"·"CAM2 뒤 반").
 * 사진 위쪽이 노트북 뒤쪽이 되게 놓고 찍는다고 보고, 노트북이 사진의 가운데 대부분을 채운다고 본다.
 * 실제 부스 사진으로 한 번 맞추면 FRAME만 고치면 된다.
 */
export const FRAME: Record<"CAM1" | "CAM2", FrameRegion> = {
  CAM1: { x0: 0.06, y0: 0.08, x1: 0.94, y1: 0.92 },
  CAM2: { x0: 0.06, y0: 0.08, x1: 0.94, y1: 0.92 },
};

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

/**
 * 사진 위 점 → 면 좌표. 윗면·키보드·바닥은 CAM1이 앞 반(v 0.5~1), CAM2가 뒤 반(v 0~0.5).
 * 옆면은 길게 누운 면이라 CAM1이 왼쪽 반(u 0~0.5), CAM2가 오른쪽 반(u 0.5~1). 폰·모르는 카메라는 사진 전체가 면이다
 */
export function faceRatio(face: CaptureFace, camera: CaptureCamera, point: [number, number], size: Size): { u: number; v: number } {
  const frame = camera === "PHONE" ? { x0: 0, y0: 0, x1: 1, y1: 1 } : FRAME[camera];
  const px = clamp01((point[0] / size.width - frame.x0) / (frame.x1 - frame.x0));
  const py = clamp01((point[1] / size.height - frame.y0) / (frame.y1 - frame.y0));
  if (camera === "PHONE") return { u: px, v: py };
  const side = face === "SF" || face === "SB" || face === "SL" || face === "SR";
  if (side) return { u: camera === "CAM1" ? px * 0.5 : 0.5 + px * 0.5, v: py };
  return { u: px, v: camera === "CAM1" ? 0.5 + py * 0.5 : py * 0.5 };
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

/** 3D 핀 하나 = 같은 흠집 묶음 하나(조명·카메라만 다른 사진의 같은 흠집) */
export interface LaptopPin {
  groupId: string;
  face: CaptureFace;
  camera: CaptureCamera;
  defectClass: DefectClass;
  placement: LocalPlacement;
  /** 이 흠집이 찍힌 사진들의 흠집(사진 보기에서 쓴다) */
  members: CatalogPhotoDefect[];
}

const SEVERITY: Record<DefectClass, number> = { stain: 0, scratch: 1, dent: 2, crack: 3 };

/**
 * 묶음마다 핀 하나. 위치는 대표 흠집(묶음의 첫 흠집) 사진에서 잰다. 종류는 묶음에서 가장 심한 것(서버 개수 세기와 같다).
 * sizeOf: 사진(면·카메라·조명)의 원본 크기. 아직 모르면 기본 해상도
 */
export function laptopPins(defects: CatalogPhotoDefect[], d: ModelDimensions, sizeOf: (defect: CatalogPhotoDefect) => Size | undefined): LaptopPin[] {
  const groups = new Map<string, CatalogPhotoDefect[]>();
  for (const defect of defects) {
    const list = groups.get(defect.groupId) ?? [];
    list.push(defect);
    groups.set(defect.groupId, list);
  }
  return [...groups.entries()].map(([groupId, members]) => {
    const head = members.find((m) => m.defectId === groupId) ?? members[0];
    const worst = members.reduce((w, m) => (SEVERITY[m.class] > SEVERITY[w] ? m.class : w), head.class);
    const ratio = faceRatio(head.face, head.camera, centroid(head.polygon), sizeOf(head) ?? DEFAULT_PHOTO_SIZE);
    return { groupId, face: head.face, camera: head.camera, defectClass: worst, placement: placeOnLaptop(head.face, ratio, d), members };
  });
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

/** 흠집 종류별 핀 색. 색만으로 구분하지 않도록 목록에는 글자도 함께 쓴다 */
export const PIN_COLOR: Record<DefectClass, string> = { scratch: "#f59e0b", dent: "#ef4444", crack: "#b91c1c", stain: "#3b82f6" };

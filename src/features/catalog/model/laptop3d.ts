import type { CaptureCamera, CaptureFace, CatalogPhotoDefect, DefectClass, ModelDimensions } from "../../../shared/api/types";
import { photoShapePoints } from "../../../shared/laptop3d/shapes";
import { centroid, DEFAULT_PHOTO_SIZE, faceRatio, placeOnLaptop, type LocalPlacement, type Size } from "../../../shared/laptop3d/faces";

// 면 좌표 규칙은 shared/laptop3d/faces.ts로 옮겼다(리포트 3D와 함께 쓴다). 기존 import를 위해 다시 내보낸다
export { bodyColor, centroid, DEFAULT_PHOTO_SIZE, faceRatio, FRAME, placeOnLaptop } from "../../../shared/laptop3d/faces";
export type { FrameQuad, LocalPlacement, Size, Vec3 } from "../../../shared/laptop3d/faces";

// 부스 사진의 흠집(원본 사진 px) → 노트북 3D 모델 위의 핀(11/8 민서 요청). 정확한 mm 위치가 아니라 대략 위치다.

/** 3D 핀 하나 = 같은 흠집 묶음 하나(조명·카메라만 다른 사진의 같은 흠집) */
export interface LaptopPin {
  groupId: string;
  face: CaptureFace;
  camera: CaptureCamera;
  defectClass: DefectClass;
  placement: LocalPlacement;
  /** 면 비율 좌표(0~1). 이전 검사와 같은 흠집인지 견줄 때 쓴다 */
  ratio: { u: number; v: number };
  /** 이 흠집이 찍힌 사진들의 흠집(사진 보기에서 쓴다) */
  members: CatalogPhotoDefect[];
  /** 대표 흠집의 실제 폴리곤을 면 좌표로 옮긴 모양(3D 모델 위에 그린다) */
  shape: [number, number][];
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
    const size = sizeOf(head) ?? DEFAULT_PHOTO_SIZE;
    const ratio = faceRatio(head.face, head.camera, centroid(head.polygon), size);
    const shape = photoShapePoints(head.face, head.camera, head.polygon, size);
    return { groupId, face: head.face, camera: head.camera, defectClass: worst, placement: placeOnLaptop(head.face, ratio, d), ratio, members, shape };
  });
}

/** 흠집 종류별 핀 색. 색만으로 구분하지 않도록 목록에는 글자도 함께 쓴다 */
export const PIN_COLOR: Record<DefectClass, string> = { scratch: "#f59e0b", dent: "#ef4444", crack: "#b91c1c", stain: "#3b82f6" };

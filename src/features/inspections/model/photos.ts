import type { CaptureCamera, CaptureFace, CaptureLight, CheckpointMedia, CheckpointPhoto, Defect, Inspection, PhotoDefect } from "../../../shared/api/types";

// 검사 결과 화면(spec 006)의 사진·흠집 겹쳐 보기 모델. 빠른 검사(QUICK) 세트는 원본 사진(CheckpointMedia.photos) 위에
// 원본 px 흠집(Inspection.photoDefects)을, 정합 세트는 면 사진(textures) 위에 표준 좌표 흠집(defects)을 겹친다(contracts 1.1.0).

/**
 * 사진 칸에 겹칠 흠집. 관리자·고객 리포트는 PhotoDefect 그대로, 공개 기기 상세(11/8)는 신뢰도·검수 기록이 없는
 * CatalogPhotoDefect를 넣는다. 그래서 신뢰도·검수는 선택이다
 */
export type GridDefect = Pick<PhotoDefect, "defectId" | "face" | "light" | "camera" | "class" | "polygon"> &
  Partial<Pick<PhotoDefect, "confidence" | "review">>;

export interface PhotoCell {
  face: CaptureFace;
  camera: CaptureCamera;
  light: CaptureLight;
  /** 그 자리의 원본 사진. 없으면 null(아직 안 올라옴) */
  photo: CheckpointPhoto | null;
  /** 그 사진에서 찾은 흠집 */
  defects: GridDefect[];
}

export interface FaceGrid {
  face: CaptureFace;
  /** 행: 카메라 */
  cameras: CaptureCamera[];
  /** 열: 조명 */
  lights: CaptureLight[];
  /** 카메라 행 → 조명 열 순서 */
  cells: PhotoCell[];
  /** 이 면 사진들의 흠집 수(사진마다 따로 센 것) */
  defectCount: number;
}

const FACE_ORDER: CaptureFace[] = ["TOP", "BOT", "KB", "SF", "SB", "SL", "SR", "SCR0", "SCR1"];
const CAMERA_ORDER: CaptureCamera[] = ["CAM1", "CAM2", "PHONE"];
const LIGHT_ORDER: CaptureLight[] = ["L1", "L2", "L3", "L4", "ROOM", "OFF"];

/** 빠른 검사(QUICK) 흠집. 계약 1.1.0 이전 서버는 photoDefects를 보내지 않으므로 빈 배열 */
export function photoDefectsOf(inspection: Inspection | null | undefined): PhotoDefect[] {
  return inspection?.photoDefects ?? [];
}

/** 원본 사진 격자: 면마다 카메라(행) × 조명(열). 사진이나 흠집이 있는 면·카메라·조명만 넣고 순서는 codes.yaml 순 */
export function faceGrids(photos: CheckpointPhoto[], defects: GridDefect[]): FaceGrid[] {
  const refs: { face: CaptureFace; camera: CaptureCamera; light: CaptureLight }[] = [...photos, ...defects];
  const faces = FACE_ORDER.filter((face) => refs.some((r) => r.face === face));
  return faces.map((face) => {
    const inFace = refs.filter((r) => r.face === face);
    const cameras = CAMERA_ORDER.filter((camera) => inFace.some((r) => r.camera === camera));
    const lights = LIGHT_ORDER.filter((light) => inFace.some((r) => r.light === light));
    const cells = cameras.flatMap((camera) =>
      lights.map((light) => ({
        face,
        camera,
        light,
        photo: photos.find((p) => p.face === face && p.camera === camera && p.light === light) ?? null,
        defects: defects.filter((d) => d.face === face && d.camera === camera && d.light === light),
      })),
    );
    return { face, cameras, lights, cells, defectCount: defects.filter((d) => d.face === face).length };
  });
}

export interface TextureOverlay {
  face: CaptureFace;
  url: string;
  defects: Defect[];
}

/** 정합 세트: 면 사진(표준 좌표) 위에 그 면의 흠집. 사진이 있는 면만, codes.yaml 순 */
export function textureOverlays(media: Pick<CheckpointMedia, "textures">, defects: Defect[]): TextureOverlay[] {
  return FACE_ORDER.flatMap((face) => {
    const texture = media.textures.find((t) => t.face === face);
    return texture ? [{ face, url: texture.url, defects: defects.filter((d) => d.face === face) }] : [];
  });
}

/** SVG polygon의 points 값 */
export function polygonPoints(polygon: number[][]): string {
  return polygon.map(([x, y]) => `${x},${y}`).join(" ");
}

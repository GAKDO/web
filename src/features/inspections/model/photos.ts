import type { CaptureCamera, CaptureFace, CaptureLight, CheckpointMedia, CheckpointPhoto, Defect, Inspection, PhotoDefect } from "../../../shared/api/types";

// 검사 결과 화면(spec 006)의 사진·흠집 겹쳐 보기 모델. 빠른 검사(QUICK) 세트는 원본 사진(CheckpointMedia.photos) 위에
// 원본 px 흠집(Inspection.photoDefects)을, 정합 세트는 면 사진(textures) 위에 표준 좌표 흠집(defects)을 겹친다(contracts 1.1.0).

/**
 * 사진 칸에 겹칠 흠집. 관리자·고객 리포트는 PhotoDefect 그대로, 공개 기기 상세(11/8)는 신뢰도·검수 기록이 없는
 * CatalogPhotoDefect를 넣는다. 그래서 신뢰도·검수는 선택이다
 */
export type GridDefect = Pick<PhotoDefect, "defectId" | "face" | "light" | "camera" | "class" | "polygon"> &
  Partial<Pick<PhotoDefect, "confidence" | "review" | "source">>;

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

/**
 * 원본 사진 px 흠집. 빠른 검사(QUICK)는 흠집이 여기에만 있고, 11/9부터 전체 검사(FULL)도 AI가 사진에서 본 것을 모두 싣는다
 * (정합 실패 면의 흠집 포함). 계약 1.1.0 이전 서버는 보내지 않으므로 빈 배열
 */
export function photoDefectsOf(inspection: Inspection | null | undefined): PhotoDefect[] {
  return inspection?.photoDefects ?? [];
}

/**
 * 빠른 검사 세트인가. profile(11/9)이 있으면 그대로 따르고, 예전 서버는 photoDefects가 QUICK에만 왔으므로 그것으로 가린다.
 * photoDefects가 있다고 QUICK이 아니다(전체 검사도 싣는다)
 */
export function isQuickInspection(inspection: Inspection | null | undefined): boolean {
  if (!inspection) return false;
  if (inspection.profile) return inspection.profile === "QUICK";
  return photoDefectsOf(inspection).length > 0;
}

/** 흠집 수를 셀 목록: 빠른 검사는 photoDefects(사진마다), 전체 검사는 표준 좌표 흠집(defects) */
export function countedDefects(inspection: Inspection | null | undefined): (PhotoDefect | Defect)[] {
  if (!inspection) return [];
  return isQuickInspection(inspection) ? photoDefectsOf(inspection) : inspection.defects;
}

export interface UnjudgeableFace {
  face: CaptureFace;
  reason: string;
  /** 선택 면을 일부러 건너뛴 것(SCR1 등). 경고하지 않는다 */
  skipped: boolean;
}

const UNJUDGEABLE_REASON = /^판정 불가 면 (TOP|BOT|SF|SB|SL|SR|KB|SCR0|SCR1): (.+)$/;
const isSkipped = (reason: string) => reason.startsWith("건너뜀");

/**
 * 판정 불가 면. unjudgeableFaces(11/9)가 있으면 그것을, 예전 서버는 등급 근거 문장("판정 불가 면 SF: …")에서 읽는다.
 * 정합 실패 면은 AI가 본 흠집이 있어도 등급에 들어가지 않으므로 화면이 눈에 띄게 알린다
 */
export function unjudgeableOf(inspection: Inspection | null | undefined): UnjudgeableFace[] {
  if (!inspection) return [];
  if (inspection.unjudgeableFaces) {
    return inspection.unjudgeableFaces.map((u) => ({ face: u.face, reason: u.reason, skipped: isSkipped(u.reason) }));
  }
  return inspection.reasons.flatMap((line) => {
    const m = UNJUDGEABLE_REASON.exec(line);
    return m ? [{ face: m[1] as CaptureFace, reason: m[2], skipped: isSkipped(m[2]) }] : [];
  });
}

/** 경고해야 하는 판정 불가 면(건너뛴 선택 면 제외) */
export function failedFaces(inspection: Inspection | null | undefined): UnjudgeableFace[] {
  return unjudgeableOf(inspection).filter((u) => !u.skipped);
}

/** 전체 검사에서 표준 좌표가 없어(정합 실패) 등급에 쓰지 않은 AI 흠집. 빠른 검사는 빈 배열 */
export function photoOnlyDefects(inspection: Inspection | null | undefined): PhotoDefect[] {
  if (!inspection || isQuickInspection(inspection)) return [];
  const graded = new Set(inspection.defects.map((d) => d.defectId));
  return photoDefectsOf(inspection).filter((d) => !graded.has(d.defectId));
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

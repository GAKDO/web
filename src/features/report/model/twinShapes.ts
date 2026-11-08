import type { Inspection, ModelDimensions, PhotoDefect } from "../../../shared/api/types";
import { DEFAULT_PHOTO_SIZE, type Size } from "../../../shared/laptop3d/faces";
import { photoShapePoints, standardFaceSize, standardShapePoints, type FaceShape } from "../../../shared/laptop3d/shapes";

// 리포트 3D 위에 그릴 실제 흠집 모양(11/8 민서 요청). 서버 폴리곤만 쓰고, 신규 여부는 서버 판정(match·isNew)만 쓴다.

/** 핀·모양 색: 서버가 신규로 판정한 흠집만 빨강, 앞 시점부터 있던(또는 비교하지 않은) 흠집은 짙은 회색 */
export const SHAPE_NEW = "#c8161d";
export const SHAPE_KNOWN = "#374151";

const dismissed = (d: { review?: { status: string } }) => d.review?.status === "DISMISSED";

/**
 * 정합 검사(표준 좌표) 흠집 → 면 모양. 표준 좌표 면 크기는 텍스처를 읽었으면 그 크기, 아니면 치수 × 4 px/mm.
 * 기각(DISMISSED)은 뺀다. newIds: 서버가 신규로 표시한 흠집 ID(타임라인 핀 isNew)
 */
export function standardShapes(inspection: Inspection | null | undefined, d: ModelDimensions, sizes: Partial<Record<string, Size>>, newIds: Set<string>, selected: string | null): FaceShape[] {
  return (inspection?.defects ?? []).flatMap((defect) => {
    if (dismissed(defect)) return [];
    const points = standardShapePoints(defect.polygon, sizes[defect.face] ?? standardFaceSize(defect.face, d));
    if (!points) return [];
    const isNew = newIds.has(defect.defectId) || defect.match?.status === "NEW";
    return [{ id: defect.defectId, face: defect.face, points, color: isNew ? SHAPE_NEW : SHAPE_KNOWN, emphasis: isNew || selected === defect.defectId }];
  });
}

/**
 * 부스 빠른 검사(원본 사진 px) 흠집 → 면 모양. 조명만 다른 사진의 같은 흠집은 묶음(groupId)마다 대표 하나만 그린다.
 * 빠른 검사는 앞 시점과 비교하지 않으므로 모두 같은 색이다
 */
export function quickShapes(defects: PhotoDefect[], sizeOf: (d: PhotoDefect) => Size | undefined): FaceShape[] {
  const heads = new Map<string, PhotoDefect>();
  for (const d of defects) {
    if (dismissed(d)) continue;
    const group = d.groupId ?? d.defectId;
    const prev = heads.get(group);
    if (!prev || d.defectId === group) heads.set(group, d);
  }
  return [...heads.entries()].map(([group, d]) => ({
    id: group,
    face: d.face,
    points: photoShapePoints(d.face, d.camera, d.polygon, sizeOf(d) ?? DEFAULT_PHOTO_SIZE),
    color: SHAPE_KNOWN,
  }));
}

import type { CaptureCamera, CaptureFace, CaptureLight, CheckpointMedia, Inspection } from "../../../shared/api/types";
import { isQuickInspection } from "./photos";
import type { ReviewGroup } from "./review";

// 검수 후보 카드 안 사진(11/12 민서 요청): 후보마다 그 흠집이 잡힌 사진과 확대 크롭을 카드 안에 바로 보여
// 아래 사진 격자까지 오르내리지 않고 흠집 맞음·아님을 정하게 한다.

/** 후보 하나가 잡힌 사진 한 장 */
export interface CandidateShot {
  defectId: string;
  face: CaptureFace;
  /** 원본 사진이면 카메라·조명, 정합된 면 사진이면 null */
  camera: CaptureCamera | null;
  light: CaptureLight | null;
  src: string;
  /** 그 사진 px 기준 후보 테두리 */
  polygon: number[][];
  confidence: number;
}

/**
 * 묶음의 후보가 잡힌 사진들(신뢰도 높은 순). 빠른 검사는 원본 사진 px(photoDefects),
 * 전체 검사는 같은 defectId의 원본 사진 px 후보가 있으면 원본 사진을, 없으면 정합된 면 사진(표준 좌표)을 쓴다
 */
export function candidateShots(group: ReviewGroup, inspection: Inspection, media: Pick<CheckpointMedia, "photos" | "textures"> | null | undefined): CandidateShot[] {
  if (!media) return [];
  const photos = media.photos ?? [];
  const textures = media.textures ?? [];
  const photoDefects = inspection.photoDefects ?? [];
  const quick = isQuickInspection(inspection);
  const shots = group.defectIds.flatMap((id): CandidateShot[] => {
    const pd = photoDefects.find((d) => d.defectId === id);
    if (pd) {
      const photo = photos.find((p) => p.face === pd.face && p.camera === pd.camera && p.light === pd.light);
      if (photo) return [{ defectId: id, face: pd.face, camera: pd.camera, light: pd.light, src: photo.url, polygon: pd.polygon, confidence: pd.confidence }];
    }
    if (quick) return [];
    const d = inspection.defects.find((x) => x.defectId === id);
    const texture = d && textures.find((t) => t.face === d.face);
    return d && texture && d.polygon ? [{ defectId: id, face: d.face, camera: null, light: null, src: texture.url, polygon: d.polygon, confidence: d.confidence }] : [];
  });
  return shots.sort((a, b) => b.confidence - a.confidence);
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 확대 크롭 영역: 후보 테두리를 감싸는 상자에 주변을 넉넉히(상자 크기만큼, 최소 사진 짧은 변의 12%) 더해
 * 4:3으로 맞추고 사진 안으로 밀어 넣는다. 흠집 주변 결을 함께 봐야 반사·먼지와 구분할 수 있다
 */
export function cropBox(polygon: number[][], imageWidth: number, imageHeight: number): Box {
  if (polygon.length === 0 || imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(maxX - minX, maxY - minY, Math.min(imageWidth, imageHeight) * 0.12);
  let width = maxX - minX + pad * 2;
  let height = maxY - minY + pad * 2;
  // 4:3
  if (width / height > 4 / 3) height = (width * 3) / 4;
  else width = (height * 4) / 3;
  width = Math.min(width, imageWidth);
  height = Math.min(height, imageHeight);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = Math.min(Math.max(cx - width / 2, 0), imageWidth - width);
  const y = Math.min(Math.max(cy - height / 2, 0), imageHeight - height);
  return { x, y, width, height };
}

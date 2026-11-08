import type { CaptureFace, CheckpointMedia, Defect, Inspection, TimelineCheckpoint } from "../../../shared/api/types";

// ③ 검사 결과 — 전후 비교(11/8). 같은 면의 직전 시점 사진과 이번 사진을 나란히 놓고,
// 흠집은 capture-server의 defect_match(match.status)만 따른다. 화면이 새 흠집을 다시 계산하거나 만들지 않는다.
// 정합 세트의 면 사진(textures)과 defects[].polygon은 같은 표준 좌표라, 앞 사진의 "같은 자리"를 그대로 표시할 수 있다

export type MarkKind = "existing" | "new" | "spot";

export interface CompareMark {
  id: string;
  polygon: number[][];
  /** existing: 앞 시점부터 있던 흠집(중립), new: 이번에 새로 생긴 흠집(빨강), spot: 앞 사진에서 새 흠집과 같은 자리(점선) */
  kind: MarkKind;
}

export interface CompareFace {
  face: CaptureFace;
  beforeUrl: string;
  afterUrl: string;
  before: CompareMark[];
  after: CompareMark[];
  newCount: number;
}

export type BeforeAfter =
  | { status: "ready"; faces: CompareFace[]; newCount: number }
  /** 비교할 수 없거나 보일 흠집이 없다. reason은 화면에 그대로 보이는 문장 */
  | { status: "unavailable"; reason: string };

/** 같은 렌탈의 직전 봉인 시점(CA2: 수령↔출고, 반납↔수령). 직전 시점이 봉인 전이면 그 앞으로 가지 않는다 */
export function previousOf(ordered: TimelineCheckpoint[], current: TimelineCheckpoint): TimelineCheckpoint | null {
  const i = ordered.findIndex((c) => c.checkpointId === current.checkpointId);
  const prev = i > 0 ? ordered[i - 1] : null;
  return prev && prev.status === "SEALED" ? prev : null;
}

/** 기각(DISMISSED)한 후보는 흠집이 아니므로 뺀다(11/8 사람 검수) */
function kept(defects: Defect[]): Defect[] {
  return defects.filter((d) => d.review?.status !== "DISMISSED");
}

/** 한 면에 보일 최대 개수. 비교는 새 흠집이 있는 면을 먼저 보인다 */
const MAX_FACES = 3;

export function beforeAfter(input: {
  current: TimelineCheckpoint;
  previous: TimelineCheckpoint | null;
  currentInspection: Inspection | null | undefined;
  previousInspection: Inspection | null | undefined;
  currentMedia: Pick<CheckpointMedia, "textures"> | null | undefined;
  previousMedia: Pick<CheckpointMedia, "textures"> | null | undefined;
}): BeforeAfter {
  const { current, previous, currentInspection, previousInspection, currentMedia, previousMedia } = input;
  if (current.type === "OUT") return { status: "unavailable", reason: "출고는 기준 시점이라 비교하지 않습니다." };
  if (current.compared === false)
    return { status: "unavailable", reason: "부스 빠른 검사로 기록해 앞 시점과 흠집을 비교하지 않았습니다. 새 흠집 여부는 표시하지 않습니다." };
  if (!previous) return { status: "unavailable", reason: "비교할 앞 시점 기록이 없습니다." };
  if (!currentInspection || !previousInspection) return { status: "unavailable", reason: "검사 기록을 아직 불러오지 못했습니다." };

  const now = kept(currentInspection.defects);
  const before = kept(previousInspection.defects);
  const faces = new Set<CaptureFace>(now.map((d) => d.face));
  const textureOf = (media: typeof currentMedia, face: CaptureFace) => media?.textures.find((t) => t.face === face)?.url;

  const list: CompareFace[] = [];
  for (const face of faces) {
    const afterUrl = textureOf(currentMedia, face);
    const beforeUrl = textureOf(previousMedia, face);
    if (!afterUrl || !beforeUrl) continue;
    const inFace = now.filter((d) => d.face === face);
    const fresh = inFace.filter((d) => d.match?.status === "NEW");
    list.push({
      face,
      afterUrl,
      beforeUrl,
      // match가 없는 흠집은 새 흠집이라고 말할 근거가 없어 중립으로 둔다
      after: inFace.map((d) => ({ id: d.defectId, polygon: d.polygon, kind: d.match?.status === "NEW" ? "new" : "existing" })),
      before: [
        ...before.filter((d) => d.face === face).map((d) => ({ id: d.defectId, polygon: d.polygon, kind: "existing" as const })),
        ...fresh.map((d) => ({ id: `spot-${d.defectId}`, polygon: d.polygon, kind: "spot" as const })),
      ],
      newCount: fresh.length,
    });
  }
  if (list.length === 0) {
    return now.length === 0
      ? { status: "unavailable", reason: "이번 시점에 기록된 흠집이 없어 비교할 자리가 없습니다." }
      : { status: "unavailable", reason: "두 시점의 같은 면 사진이 없어 나란히 비교할 수 없습니다." };
  }
  list.sort((a, b) => b.newCount - a.newCount);
  const shown = list.slice(0, MAX_FACES);
  return { status: "ready", faces: shown, newCount: list.reduce((n, f) => n + f.newCount, 0) };
}

/** 폴리곤을 감싸는 사각형(사진 px). 꼬리표 위치·나타나는 시각 계산에 쓴다 */
export function boundsOf(polygon: number[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

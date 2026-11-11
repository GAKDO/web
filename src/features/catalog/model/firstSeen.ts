import type { CaptureFace, CheckpointType } from "../../../shared/api/types";

// 흠집별 "처음 발견된 검사"(11/11 민서 요청). 서버는 검사마다 흠집을 따로 찾고 이어 붙이지 않으므로,
// 화면이 이전 검사(공개 상세)의 흠집과 같은 면·가까운 위치끼리 이어 본다. 정확한 추적이 아니라 대략 판단이다.

/** 면 좌표(0~1)에서 이 거리 안이면 같은 흠집으로 본다. 부스·카메라마다 위치가 조금씩 어긋나는 것을 감안한 값 */
export const SAME_DEFECT_DISTANCE = 0.08;

/** 비교에 쓰는 흠집 하나: 면과 면 비율 좌표 */
export interface PinSpot {
  groupId: string;
  face: CaptureFace;
  ratio: { u: number; v: number };
}

/** 한 검사의 흠집들. 검사 목록은 최근 것부터(rental 공개 목록 순서) */
export interface InspectionSpots {
  checkpointId: string;
  type: CheckpointType;
  gradedAt: string;
  spots: PinSpot[];
}

export interface FirstSeen {
  checkpointId: string;
  type: CheckpointType;
  gradedAt: string;
  /** 지금 보이는 검사에서 처음 나왔고, 그 전에 비교할 검사가 있었다(= 새로 생긴 흠집) */
  isNew: boolean;
}

const near = (a: PinSpot, b: PinSpot) => a.face === b.face && Math.hypot(a.ratio.u - b.ratio.u, a.ratio.v - b.ratio.v) <= SAME_DEFECT_DISTANCE;

/**
 * 지금 검사(current)의 흠집마다 처음 발견된 검사를 찾는다.
 * older는 current보다 이전 검사들(최근 것부터). 같은 흠집이 이어진 가장 오래된 검사가 처음 발견이다.
 * 중간 검사에서 한 번 놓쳐도(예: 조명 차이) 더 오래된 검사에 있으면 그 검사를 처음으로 본다.
 */
export function firstSeenOf(current: InspectionSpots, older: InspectionSpots[]): Map<string, FirstSeen> {
  const out = new Map<string, FirstSeen>();
  for (const spot of current.spots) {
    let first: InspectionSpots = current;
    for (const past of older) if (past.spots.some((s) => near(spot, s))) first = past;
    out.set(spot.groupId, { checkpointId: first.checkpointId, type: first.type, gradedAt: first.gradedAt, isNew: first === current && older.length > 0 });
  }
  return out;
}

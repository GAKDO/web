import type { CaptureCamera, CaptureFace, CaptureLight, Defect, DefectClass, DismissReason, Inspection, PhotoDefect, ReviewStatus } from "../../../shared/api/types";

// 사람 검수 화면 모델(11/8). AI는 넓게 잡고(오탐 허용) 사람이 흠집 맞음·아님을 정한다.
// 같은 흠집이 조명만 다른 사진마다 따로 잡히므로 groupId(같은 면·카메라에서 겹치는 묶음)로 묶어 한 번에 정한다.

/** 신뢰도 이 값 이상은 "흠집 의심", 그 아래(부스 문턱 0.25까지)는 "확인 필요" */
export const SUSPECT_CONFIDENCE = 0.4;

export type ReviewLevel = "suspect" | "check";
export const REVIEW_LEVEL_LABEL: Record<ReviewLevel, string> = { suspect: "흠집 의심", check: "확인 필요" };

export function levelOf(confidence: number): ReviewLevel {
  return confidence >= SUSPECT_CONFIDENCE ? "suspect" : "check";
}

/** 검수 묶음 하나: 같은 흠집으로 보이는 후보들 */
export interface ReviewGroup {
  groupId: string;
  defectIds: string[];
  class: DefectClass;
  face: CaptureFace;
  camera: CaptureCamera | null;
  lights: CaptureLight[];
  /** 묶음에서 가장 높은 신뢰도 */
  confidence: number;
  level: ReviewLevel;
  /** 묶음 안 결정이 서로 다르면 "MIXED"(다시 정하면 하나로 맞춰진다) */
  status: ReviewStatus | "MIXED";
  reason: DismissReason | null;
}

type Candidate = (PhotoDefect | Defect) & { review?: { status: ReviewStatus; reason: DismissReason | null } };

const statusOf = (d: Candidate): ReviewStatus => d.review?.status ?? "PENDING";

/** 검수할 후보 묶음. 빠른 검사는 photoDefects를 groupId로, 정합 세트는 defects를 하나씩. 신뢰도 높은 묶음부터 */
export function reviewGroups(inspection: Inspection | null | undefined): ReviewGroup[] {
  if (!inspection) return [];
  const photo = inspection.photoDefects ?? [];
  const list: Candidate[] = photo.length > 0 ? photo : inspection.defects.filter((d) => d.source === "AUTO");
  const byGroup = new Map<string, Candidate[]>();
  for (const d of list) {
    const key = ("groupId" in d && d.groupId) || d.defectId;
    byGroup.set(key, [...(byGroup.get(key) ?? []), d]);
  }
  const groups = [...byGroup.entries()].map(([groupId, items]): ReviewGroup => {
    const first = items[0];
    const confidence = Math.max(...items.map((d) => d.confidence));
    const statuses = new Set(items.map(statusOf));
    const status = statuses.size === 1 ? statusOf(first) : "MIXED";
    return {
      groupId,
      defectIds: items.map((d) => d.defectId),
      class: first.class,
      face: first.face,
      camera: "camera" in first ? first.camera : null,
      lights: "light" in first ? [...new Set(items.map((d) => (d as PhotoDefect).light))] : [],
      confidence,
      level: levelOf(confidence),
      status,
      reason: status === "DISMISSED" ? (first.review?.reason ?? null) : null,
    };
  });
  return groups.sort((a, b) => b.confidence - a.confidence);
}

/** 사람이 검수해야 하는 상태: 후보가 있고 아직 검수를 완료하지 않았다(그동안 등급은 null) */
export function isReviewOpen(inspection: Inspection | null | undefined): boolean {
  const review = inspection?.review;
  if (!review || review.completedAt !== null) return false;
  return review.pending + review.confirmed + review.dismissed > 0;
}

/** 묶음에 내릴 결정을 그 묶음 후보 전부에 보내는 요청 항목 */
export function decisionItems(group: ReviewGroup, decision: ReviewStatus, reason?: DismissReason) {
  return group.defectIds.map((defectId) => (decision === "DISMISSED" ? { defectId, decision, reason } : { defectId, decision }));
}

/** 사람이 흠집 아님으로 정한 흠집 id(사진 위에 흐리게 그린다) */
export function dismissedIds(inspection: Inspection | null | undefined): Set<string> {
  const all: Candidate[] = [...(inspection?.photoDefects ?? []), ...(inspection?.defects ?? [])];
  return new Set(all.filter((d) => d.review?.status === "DISMISSED").map((d) => d.defectId));
}

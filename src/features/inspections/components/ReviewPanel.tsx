import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import type { DismissReason, Inspection } from "../../../shared/api/types";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, DEFECT_CLASS_LABEL, DISMISS_REASON_LABEL, REVIEW_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCompleteReview, useSaveReviews } from "../api/reviews";
import { decisionItems, REVIEW_LEVEL_LABEL, reviewGroups, type ReviewGroup } from "../model/review";
import { formatConfidence } from "../model/verdict";

const REASONS = Object.keys(DISMISS_REASON_LABEL) as DismissReason[];

const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");

/** 화면이 열린 동안 쓰는 검수 완료 요청 키(두 번 눌러도 한 번만 처리) */
function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function GroupCard({ group, index, busy, onDecide }: { group: ReviewGroup; index: number; busy: boolean; onDecide: (decision: "CONFIRMED" | "DISMISSED" | "PENDING", reason?: DismissReason) => void }) {
  const [askingReason, setAskingReason] = useState(false);
  const where = [CAPTURE_FACE_LABEL[group.face], group.camera && CAPTURE_CAMERA_LABEL[group.camera], group.lights.map((l) => CAPTURE_LIGHT_LABEL[l]).join("·")].filter(Boolean).join(" · ");
  const decided = group.status === "CONFIRMED" || group.status === "DISMISSED";
  return (
    <li
      className={cn("grid gap-2 rounded-xl border bg-card p-4 shadow-xs", group.status === "CONFIRMED" && "border-destructive/40", group.status === "DISMISSED" && "opacity-70")}
      aria-label={`후보 ${index + 1}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <strong>
          {index + 1}. {DEFECT_CLASS_LABEL[group.class]}
        </strong>
        <span>{where}</span>
        <span>신뢰도 {formatConfidence(group.confidence)}</span>
        <Badge variant={group.level === "suspect" ? "destructive" : "warning"}>{REVIEW_LEVEL_LABEL[group.level]}</Badge>
        {group.defectIds.length > 1 && <span className="text-muted-foreground">사진 {group.defectIds.length}장에서 함께 잡힘</span>}
      </div>
      <p className="m-0 text-sm" aria-label="검수 상태">
        {group.status === "MIXED" ? "사진마다 결정이 달라요. 다시 정해 주세요." : REVIEW_STATUS_LABEL[group.status]}
        {group.reason && ` · ${DISMISS_REASON_LABEL[group.reason]}`}
      </p>
      {askingReason ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="흠집이 아닌 이유">
          {REASONS.map((r) => (
            <Button
              key={r}
              size="sm"
              disabled={busy}
              onClick={() => {
                setAskingReason(false);
                onDecide("DISMISSED", r);
              }}
            >
              {DISMISS_REASON_LABEL[r]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setAskingReason(false)}>
            취소
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={group.status === "CONFIRMED" ? "default" : "outline"} disabled={busy} onClick={() => onDecide("CONFIRMED")}>
            흠집 맞음
          </Button>
          <Button size="sm" variant={group.status === "DISMISSED" ? "secondary" : "outline"} disabled={busy} onClick={() => setAskingReason(true)}>
            흠집 아님
          </Button>
          {decided && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("PENDING")}>
              되돌리기
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * 사람 검수(11/8): AI가 1차로 넓게 잡은 후보를 관리자가 사진과 비교해 흠집 맞음·아님으로 정하고, 모두 정하면 검수를 완료한다.
 * 완료하면 흠집 아님을 뺀 흠집으로 등급이 매겨지고 기록이 봉인된다. 흠집 아님은 다음 학습에 "흠집 아닌 예"로 쓴다
 */
export function ReviewPanel({ checkpointId, inspection }: { checkpointId: string; inspection: Inspection }) {
  const save = useSaveReviews(checkpointId);
  const [key] = useState(newKey);
  const complete = useCompleteReview(checkpointId, key);
  const groups = reviewGroups(inspection);
  const review = inspection.review;
  const left = groups.filter((g) => g.status === "PENDING" || g.status === "MIXED").length;
  const busy = save.isPending || complete.isPending;
  const error = save.error ?? complete.error;

  const decideAll = (decision: "CONFIRMED") =>
    save.mutate(groups.filter((g) => g.status === "PENDING" || g.status === "MIXED").flatMap((g) => decisionItems(g, decision)));

  return (
    <section aria-labelledby="review-title" className="mb-6 rounded-xl border-2 border-warning/40 bg-warning-soft/40 p-4">
      <h2 id="review-title" className="mt-0 mb-2 text-lg font-semibold tracking-tight">사람 검수 · 남은 후보 {left}곳</h2>
      <p className="mt-0 text-sm text-muted-foreground">
        AI가 흠집일 수 있는 곳을 넓게 잡았어요. 아래 사진과 비교해 하나씩 정해 주세요. 신뢰도 {formatConfidence(0.4)} 이상은 흠집 의심, 그 아래는 확인 필요예요.
        흠집 아님으로 정한 곳은 등급에서 빠지고 다음 학습에 쓰입니다.
      </p>
      {review && (
        <p className="mt-0 mb-3 text-sm font-medium" aria-label="검수 현황">
          흠집 맞음 {review.confirmed} · 흠집 아님 {review.dismissed} · 남은 사진 {review.pending}장
        </p>
      )}
      {error && <ErrorBanner message={toMessage(error)} />}
      <ul className="m-0 grid list-none gap-2 p-0" aria-label="검수 후보">
        {groups.map((g, i) => (
          <GroupCard key={g.groupId} group={g} index={i} busy={busy} onDecide={(decision, reason) => save.mutate(decisionItems(g, decision, reason))} />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="default" busy={complete.isPending} disabled={left > 0 || save.isPending} onClick={() => complete.mutate()}>
          검수 완료하고 판정하기
        </Button>
        {left > 0 && (
          <Button disabled={busy} onClick={() => decideAll("CONFIRMED")}>
            남은 {left}곳 모두 흠집 맞음
          </Button>
        )}
        {left > 0 && <span className="text-sm text-muted-foreground">모든 후보를 정하면 완료할 수 있어요.</span>}
      </div>
    </section>
  );
}

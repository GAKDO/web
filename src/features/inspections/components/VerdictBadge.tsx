import type { VariantProps } from "class-variance-authority";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { Checkpoint } from "../../../shared/api/types";
import { useCheckpointInspection } from "../api/inspections";
import { verdictOf, type Verdict } from "../model/verdict";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** 판정 종류별 배지 색. 문제 있음은 색 + 글자(✖·등급)로 함께 구분한다 */
export const VERDICT_VARIANT: Record<Verdict["kind"], BadgeVariant> = {
  none: "secondary",
  pending: "warning",
  ungradable: "secondary",
  ok: "success",
  bad: "destructive",
};

/** 목록 줄의 판정 글자. 지금 시점의 검사 결과를 하나씩 읽는다(spec 006 FR-003) */
export function VerdictBadge({ checkpoint }: { checkpoint: Checkpoint | null | undefined }) {
  const inspection = useCheckpointInspection(checkpoint?.checkpointId);
  if (checkpoint && inspection.isError) {
    return <Badge variant="secondary">판정을 읽지 못함</Badge>;
  }
  const verdict = verdictOf(checkpoint, !checkpoint ? null : inspection.isPending ? "loading" : (inspection.data ?? null));
  return <Badge variant={VERDICT_VARIANT[verdict.kind]}>{verdict.label}</Badge>;
}

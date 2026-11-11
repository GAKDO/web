import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { Inspection, RentalSummary } from "../../../shared/api/types";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { maskSerial } from "../../../shared/ui/maskSerial";
import { BoothCodePanel } from "../../rentals/components/BoothCodePanel";
import { useCheckpointInspection, useCheckpointMedia } from "../../inspections/api/inspections";
import { PhotoGrid } from "../../inspections/components/PhotoGrid";
import { countedDefects, failedFaces, faceGrids, photoDefectsOf, unjudgeableOf } from "../../inspections/model/photos";
import { UnjudgeableNotice } from "../../inspections/components/UnjudgeableNotice";
import { PARTIAL_OK_LABEL, verdictOf, type Verdict } from "../../inspections/model/verdict";
import { isReviewOpen } from "../../inspections/model/review";
import { PlaceDemo } from "../../../shared/motion/PlaceDemo";
import { StepTrail, trailOf } from "../../../shared/motion/StepTrail";

const VERDICT_BOX: Record<Verdict["kind"], string> = {
  ok: "border-success/40 bg-success-soft text-success",
  bad: "border-destructive/40 bg-destructive-soft text-destructive",
  none: "border-border bg-card",
  pending: "border-warning/40 bg-warning-soft text-warning",
  ungradable: "border-border bg-card",
};
const VERDICT_MARK: Record<Verdict["kind"], string> = { ok: "✔", bad: "✖", none: "·", pending: "…", ungradable: "?" };

/** 고른 기기 하나. 찍기 전이면 부스 코드, 찍은 뒤면 판정·사진(3초마다 다시 읽어 판정이 나오면 바로 바뀜) */
export function BoothDevicePanel({ rental, modelName }: { rental: RentalSummary; modelName: string }) {
  const cp = rental.currentCheckpoint ?? null;
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="m-0 text-2xl font-bold">{modelName}</h2>
        <p className="m-0 text-sm text-muted-foreground">
          시리얼 {maskSerial(rental.serial)}
          {cp ? ` · ${CHECKPOINT_TYPE_LABEL[cp.type]} · ${CHECKPOINT_STATUS_LABEL[cp.status]}` : " · 시점 없음"}
        </p>
      </div>
      {cp?.status === "OPEN" && (
        <>
          {/* 노트북을 표시 칸에 맞춰 놓는 짧은 시범(11/8, 한 번) */}
          <PlaceDemo variant="place" />
          <ol className="m-0 grid gap-1 rounded-xl border bg-card p-4 pl-8 text-sm">
            <li>노트북을 부스에 넣습니다.</li>
            <li>
              부스(Jetson) 화면의 <b>기다리는 기기</b>에서 끝자리가 <b>{rental.serial.slice(-4)}</b>인 시리얼을 누르거나, 아래 부스 코드를 넣습니다.
            </li>
            <li>찍고 나면 이 화면에 판정과 사진이 저절로 뜹니다.</li>
          </ol>
          <BoothCodePanel rentalId={rental.rentalId} checkpoint={cp} />
        </>
      )}
      {cp && cp.status !== "OPEN" && <Result rentalId={rental.rentalId} checkpointId={cp.checkpointId} status={cp.status} />}
    </div>
  );
}

function Result({ rentalId, checkpointId, status }: { rentalId: string; checkpointId: string; status: NonNullable<RentalSummary["currentCheckpoint"]>["status"] }) {
  const inspection = useCheckpointInspection(checkpointId);
  const verdict = verdictOf({ status }, inspection.isPending ? "loading" : (inspection.data ?? null));
  // A여도 판정 불가 면이 있으면 "문제 없음"으로 크게 보이지 않게 경고 색·문구로(11/9)
  const partialOk = verdict.kind === "ok" && failedFaces(inspection.data).length > 0;
  return (
    <>
      <StepTrail steps={boothSteps(status, inspection.data ?? null)} label="검사 진행" stalled={inspection.isError} />
      {inspection.isError ? (
        <ErrorBanner message="판정을 읽지 못했습니다." onRetry={() => void inspection.refetch()} />
      ) : (
        // 라이브 영역(role=status)은 그대로 두고, 판정이 바뀌면(촬영 대기 → 검수 대기 → 문제 없음 등) 안쪽 내용만 짧게 다시 떠오른다
        <div role="status" aria-label="판정" className={cn("rounded-xl border-2 p-5 shadow-xs", partialOk ? VERDICT_BOX.pending : VERDICT_BOX[verdict.kind])}>
          <div key={verdict.kind} className="grid animate-enter gap-1">
            <p className="m-0 text-3xl font-bold">
              <span aria-hidden="true">{partialOk ? "⚠" : VERDICT_MARK[verdict.kind]} </span>
              {partialOk ? PARTIAL_OK_LABEL : verdict.label}
            </p>
            {inspection.data && <Reasons inspection={inspection.data} />}
          </div>
        </div>
      )}
      <UnjudgeableNotice inspection={inspection.data} />
      <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-self-start")} to={`/admin/inspections/${rentalId}/${checkpointId}`}>
        자세히(흠집 목록)
      </Link>
      <Photos checkpointId={checkpointId} inspection={inspection.data ?? null} />
    </>
  );
}

const BOOTH_STEPS = ["촬영", "AI 흠집 후보", "직원 확인", "판정"];

/**
 * 부스 검사 진행 단계. 시점 상태(CAPTURED·GRADED·SEALED)와 검사 결과(검수 대기 여부·등급)로만 정하고 백분율은 보이지 않는다.
 * 촬영됨인데 검사 결과가 없으면 AI가 사진을 보는 중, 후보가 남아 있으면 직원 확인 중, 등급이 있으면 판정 끝
 */
function boothSteps(status: BoothStatus, inspection: Inspection | null) {
  if (status === "GRADED" || status === "SEALED" || inspection?.grade) return trailOf(BOOTH_STEPS, BOOTH_STEPS.length);
  if (inspection && isReviewOpen(inspection)) return trailOf(BOOTH_STEPS, 2);
  if (inspection) return trailOf(BOOTH_STEPS, 3);
  return trailOf(BOOTH_STEPS, 1);
}

type BoothStatus = NonNullable<RentalSummary["currentCheckpoint"]>["status"];

function Reasons({ inspection }: { inspection: Inspection }) {
  const count = countedDefects(inspection).length;
  return (
    <p className="m-0 text-sm text-foreground">
      흠집 {count}개{inspection.reasons.length > 0 ? ` · ${inspection.reasons.join(" · ")}` : ""}
    </p>
  );
}

function Photos({ checkpointId, inspection }: { checkpointId: string; inspection: Inspection | null }) {
  const media = useCheckpointMedia(checkpointId);
  if (media.isPending) return <p className="text-muted-foreground">사진 불러오는 중…</p>;
  if (media.isError) return <ErrorBanner message="사진을 불러오지 못했습니다." onRetry={() => void media.refetch()} />;
  const photos = media.data?.photos ?? [];
  if (photos.length === 0) return <p className="text-muted-foreground">사진이 아직 올라오지 않았습니다.</p>;
  // 빠른·전체 검사 모두 원본 사진 위에 AI가 본 흠집 폴리곤을 그린다(전체 검사는 11/9부터 서버가 싣는다)
  return <PhotoGrid grids={faceGrids(photos, photoDefectsOf(inspection))} unjudgeable={unjudgeableOf(inspection)} />;
}

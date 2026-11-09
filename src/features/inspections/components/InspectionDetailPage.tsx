import { maskSerial } from "../../../shared/ui/maskSerial";
import { MaskedSerial } from "../../../shared/ui/MaskedSerial";
import { PageHeader, SectionTitle } from "../../../shared/ui/PageHeader";
import { InfoList } from "../../../shared/ui/InfoList";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import type { Defect, Inspection, PhotoDefect } from "../../../shared/api/types";
import {
  CAPTURE_CAMERA_LABEL,
  CAPTURE_FACE_LABEL,
  CAPTURE_LIGHT_LABEL,
  CHECKPOINT_STATUS_LABEL,
  CHECKPOINT_TYPE_LABEL,
  DEFECT_CLASS_LABEL,
  DEFECT_SOURCE_LABEL,
  DISMISS_REASON_LABEL,
  REVIEW_STATUS_LABEL,
} from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { formatDateTime } from "../../../shared/ui/format";
import { RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { useRental } from "../../rentals/api/rentals";
import { useCheckpointInspection, useCheckpointMedia } from "../api/inspections";
import { failedFaces, faceGrids, isQuickInspection, photoDefectsOf, photoOnlyDefects, textureOverlays, unjudgeableOf } from "../model/photos";
import { UnjudgeableNotice } from "./UnjudgeableNotice";
import { formatConfidence, formatMm, PARTIAL_OK_LABEL, repairOf, verdictOf, type Verdict } from "../model/verdict";
import { PhotoGrid, TextureList } from "./PhotoGrid";
import { isReviewOpen } from "../model/review";
import { ReviewPanel } from "./ReviewPanel";

/** 판정 상자 색. 늘 기호(✔·✖)와 글자를 같이 보여 색만으로 뜻을 전하지 않는다 */
const BOX = {
  ok: "border-success/40 bg-success-soft text-success",
  bad: "border-destructive/40 bg-destructive-soft text-destructive",
  unknown: "border-border bg-card text-foreground",
} as const;
const VERDICT_BOX: Record<Verdict["kind"], string> = {
  ok: BOX.ok,
  bad: BOX.bad,
  none: BOX.unknown,
  pending: BOX.unknown,
  ungradable: BOX.unknown,
};
// .verdict-title은 테스트가 판정 글자를 찾는 표시(모양은 Tailwind)
const VERDICT_TITLE = "verdict-title m-0 text-xl font-bold";
const BOX_BASE = "grid gap-1 rounded-xl border-2 p-4 shadow-xs [&_p]:m-0";
const BOX_LABEL = "text-sm opacity-80";
const VERDICT_MARK: Record<Verdict["kind"], string> = { ok: "✔", bad: "✖", none: "·", pending: "…", ungradable: "?" };

/** 돌아갈 곳: 목록·렌탈 상세가 링크 state로 넘긴 주소(검색 조건 포함). 없으면 검사 결과 목록 */
export interface BackTo {
  path: string;
  label: string;
}

/** 검수 상태 글자(11/8). 검수 기록이 없는 예전 결과는 비운다 */
function reviewNote(review: PhotoDefect["review"]): string | undefined {
  if (!review) return undefined;
  return review.reason ? `${REVIEW_STATUS_LABEL[review.status]} · ${DISMISS_REASON_LABEL[review.reason]}` : REVIEW_STATUS_LABEL[review.status];
}

/** 흠집 카드 한 줄. 빠른 검사(원본 px)와 정합 세트(표준 좌표·mm) 둘 다 이 모양으로 */
interface DefectRow {
  id: string;
  classLabel: string;
  where: string[];
  confidence: number;
  /** undefined면 길이를 재지 않은 것(빠른 검사), null이면 읽지 못한 것 */
  lengthMm?: number | null;
  areaMm2?: number | null;
  /** 출처(정합 세트만). 빠른 검사는 비운다 */
  note?: string;
  /** 사람이 직접 표시(11/9): 신뢰도를 보이지 않는다 */
  human?: boolean;
}

const fromPhotoDefect = (d: PhotoDefect): DefectRow => ({
  id: d.defectId,
  classLabel: DEFECT_CLASS_LABEL[d.class],
  where: [CAPTURE_FACE_LABEL[d.face], `${CAPTURE_CAMERA_LABEL[d.camera]} · ${CAPTURE_LIGHT_LABEL[d.light]}`],
  confidence: d.confidence,
  // 사람이 직접 표시한 흠집(11/9)은 검수 상태 대신 출처를 적는다
  note: d.source === "HUMAN" ? DEFECT_SOURCE_LABEL.HUMAN : reviewNote(d.review),
  human: d.source === "HUMAN",
});

const fromDefect = (d: Defect): DefectRow => ({
  id: d.defectId,
  classLabel: DEFECT_CLASS_LABEL[d.class],
  where: [CAPTURE_FACE_LABEL[d.face]],
  confidence: d.confidence,
  lengthMm: d.lengthMm,
  areaMm2: d.areaMm2,
  note: [DEFECT_SOURCE_LABEL[d.source], reviewNote(d.review)].filter(Boolean).join(" · "),
  human: d.source === "HUMAN",
});

function DefectCard({ row, index }: { row: DefectRow; index: number }) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-xs" aria-label={`흠집 ${index + 1}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <strong>
          {index + 1}. {row.classLabel}
        </strong>
        {row.where.map((w) => (
          <span key={w}>{w}</span>
        ))}
        {!row.human && <span>신뢰도 {formatConfidence(row.confidence)}</span>}
        {row.lengthMm !== undefined && <span>길이 {formatMm(row.lengthMm)}</span>}
        {row.areaMm2 !== undefined && <span>면적 {formatMm(row.areaMm2, "mm²")}</span>}
        {row.note && <span className="text-muted-foreground">{row.note}</span>}
      </div>
    </li>
  );
}

/** 사진 보기: QUICK 세트는 원본 사진 격자 + 원본 px 흠집, 정합 세트는 면 사진 + 표준 좌표 흠집(spec 006 FR-004·005) */
function Photos({ checkpointId, inspection }: { checkpointId: string; inspection: Inspection | null }) {
  const media = useCheckpointMedia(checkpointId);
  if (media.isPending) return <p className="text-muted-foreground">사진 불러오는 중…</p>;
  if (media.isError) return <ErrorBanner message="사진을 불러오지 못했습니다." onRetry={() => void media.refetch()} />;
  const photoDefects = photoDefectsOf(inspection);
  const photos = media.data?.photos ?? [];
  const textures = media.data?.textures ?? [];
  const unjudgeable = unjudgeableOf(inspection);
  // 빠른 검사(QUICK)는 면 사진이 없고 흠집이 원본 사진 px(photoDefects)라 원본 사진 격자로 간다.
  if (isQuickInspection(inspection) || (photos.length > 0 && textures.length === 0)) return <PhotoGrid grids={faceGrids(photos, photoDefects)} unjudgeable={unjudgeable} />;
  // 전체 검사(11/9): AI가 원본 사진에서 무엇을 봤는지(정합 실패 면 포함) 먼저 보이고, 정합된 면 사진(표준 좌표 흠집)은 그 아래에
  if (photos.length > 0) {
    return (
      <>
        <PhotoGrid grids={faceGrids(photos, photoDefects)} unjudgeable={unjudgeable} />
        {media.data && textures.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-base font-semibold">정합된 면 사진(등급 계산에 쓴 좌표)</h3>
            <TextureList overlays={textureOverlays(media.data, inspection?.defects ?? [])} />
          </>
        )}
      </>
    );
  }
  if (media.data && textures.length > 0) return <TextureList overlays={textureOverlays(media.data, inspection?.defects ?? [])} />;
  return <p className="text-muted-foreground">사진이 아직 없습니다.</p>;
}

const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "불러오지 못했습니다.");

/** 한 시점의 검사 결과(spec 006 US2): 판정 상자·근거·흠집 카드·사진 위 흠집 겹쳐 보기 */
export function InspectionDetailPage() {
  const { rentalId = "", checkpointId = "" } = useParams();
  const state = useLocation().state as { serial?: string; backTo?: BackTo } | null;
  const hint = state?.serial;
  const backTo = state?.backTo;
  const rental = useRental(rentalId);
  const checkpoint = rental.data?.checkpoints.find((c) => c.checkpointId === checkpointId) ?? null;
  // 이 렌탈의 시점일 때만 검사 결과를 읽는다. 다른 렌탈의 시점 주소를 넣어도 그 결과가 이 렌탈 아래 보이지 않는다
  const inspection = useCheckpointInspection(checkpoint?.checkpointId);
  const serial = rental.data?.serial || hint || "";
  const shownSerial = serial ? maskSerial(serial) : "";
  const title = checkpoint ? `${shownSerial} ${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사 결과` : `${shownSerial} 검사 결과`.trim();

  if (rental.isPending || (checkpoint && inspection.isPending)) return <p className="text-muted-foreground">불러오는 중…</p>;
  const error = rental.isError ? rental.error : inspection.isError ? inspection.error : null;
  if (error) {
    return (
      <section className="max-w-xl">
        <PageHeader title={title} />
        <ErrorBanner
          message={toMessage(error)}
          onRetry={() => {
            void rental.refetch();
            if (checkpoint) void inspection.refetch();
          }}
        />
        <Link className={cn(buttonVariants({ variant: "outline" }), "mt-4")} to={backTo?.path ?? "/admin/inspections"}>
          <ArrowLeft aria-hidden="true" />
          {backTo?.label ?? "검사 결과 목록으로"}
        </Link>
      </section>
    );
  }
  // 렌탈에 그 시점이 없으면(주소가 틀림) 읽지 않았으므로 검사 전으로 보인다
  const data = checkpoint ? (inspection.data ?? null) : null;
  const verdict = verdictOf(checkpoint, data);
  // 빠른 검사(QUICK)는 흠집이 photoDefects에만 있고 defects는 빈 배열이다(contracts 1.1.0)
  const quick = isQuickInspection(data);
  // 전체 검사는 등급에 쓴 표준 좌표 흠집 + 정합 실패 면에서 AI가 본 후보(등급 미반영)를 함께 적는다(11/9)
  const ignored = photoOnlyDefects(data);
  const rows = quick
    ? photoDefectsOf(data).map(fromPhotoDefect)
    : [...(data?.defects ?? []).map(fromDefect), ...ignored.map((d) => ({ ...fromPhotoDefect(d), note: [fromPhotoDefect(d).note, "판정 불가 면 · 등급 미반영"].filter(Boolean).join(" · ") }))];
  const partial = failedFaces(data).length > 0;
  const partialOk = partial && verdict.kind === "ok";

  const repair = repairOf(verdict);
  // 사람 검수 중이면 사진과 후보를 판정보다 먼저 보인다(사진을 보며 정하게)
  const reviewing = !!checkpoint && isReviewOpen(data);
  const back: BackTo = backTo ?? { path: "/admin/inspections", label: "검사 결과 목록으로" };

  return (
    <section>
      <p className="mt-0 mb-3 text-sm">
        <Link className="inline-flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground" to={back.path}>
          ← {back.label}
        </Link>
      </p>
      {/* ① 검사 식별 정보와 검사 시각 */}
      <PageHeader
        title={title}
        description={
          checkpoint && (
            <>
              검사 시각 {formatDateTime(checkpoint.occurredAt)} · 시점 상태 {CHECKPOINT_STATUS_LABEL[checkpoint.status]}
              {data?.ruleVersion && ` · 판정 규칙 ${data.ruleVersion}`}
            </>
          )
        }
      />

      {/* ①-0 일부 면 판정 불가(11/9): 판정·검수보다 먼저 알린다 */}
      {data && (
        <div className="mb-4">
          <UnjudgeableNotice inspection={data} />
        </div>
      )}

      {/* ①-1 사람 검수(11/8): AI 후보를 사진과 비교해 정한다 */}
      {reviewing && data && (
        <>
          <ReviewPanel checkpointId={checkpointId} inspection={data} />
          <SectionTitle>검사 사진</SectionTitle>
          <Photos checkpointId={checkpointId} inspection={data} />
        </>
      )}

      {/* ② 문제 항목 요약 */}
      {data && !reviewing && (
        <section aria-labelledby="summary-title">
          <SectionTitle id="summary-title">문제 항목 요약 · 흠집 {rows.length}개</SectionTitle>
          {rows.length === 0 ? (
            // 흠집 목록이 비어도 등급이 B~D일 수 있다(근거만 있음). "문제 없음"은 A 등급일 때만 쓴다
            <p className={cn("rounded-xl border px-4 py-3 font-semibold", verdict.kind === "ok" ? "border-success/40 bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{verdict.kind === "ok" ? (partial ? "판정한 면에서는 흠집 없음 · 판정 불가 면은 위 경고를 봐 주세요" : "✔ 발견된 문제 없음") : "등록된 흠집 위치 없음 · 판정 근거는 아래 최종 판정을 봐 주세요"}</p>
          ) : (
            <>
              {quick && <p className="text-sm text-muted-foreground">사진마다 따로 센 수입니다. 조명만 다른 사진에 겹친 같은 흠집은 등급을 매길 때 하나로 봅니다.</p>}
              <ul className="m-0 grid list-none gap-2 p-0" aria-label="흠집">
                {rows.map((row, i) => (
                  <DefectCard key={row.id} row={row} index={i} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ③ 최종 판정과 수리 필요 여부(따로 보인다) */}
      <SectionTitle>최종 판정</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn(BOX_BASE, partialOk ? VERDICT_BOX.pending : VERDICT_BOX[verdict.kind])} role="status" aria-label="판정">
          <p className={BOX_LABEL}>판정</p>
          <p className={VERDICT_TITLE}>
            {partialOk ? `⚠ ${PARTIAL_OK_LABEL}` : `${VERDICT_MARK[verdict.kind]} ${verdict.label}`}
          </p>
          {partialOk && <p>등급 {verdict.grade}는 판정할 수 있던 면만 보고 매긴 것입니다.</p>}
          {verdict.kind === "pending" && <p>{reviewing ? "위에서 AI 후보를 모두 정하고 검수를 완료하면 등급이 매겨집니다." : "부스 사진이 올라오고 등급이 매겨지면 여기에 보입니다."}</p>}
          {verdict.kind === "none" && <p>이 렌탈에 그런 시점이 없습니다.</p>}
          {data?.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
        <div className={cn(BOX_BASE, repair.needed === null ? BOX.unknown : repair.needed ? BOX.bad : BOX.ok)} role="status" aria-label="수리 필요 여부">
          <p className={BOX_LABEL}>수리 필요 여부</p>
          <p className={VERDICT_TITLE}>
            {repair.needed === null ? "…" : repair.needed ? "✖" : "✔"} {repair.label}
            {partialOk && " (판정한 면 기준)"}
          </p>
          <p className={BOX_LABEL}>등급 A는 수리 필요 없음, B~D는 수리 필요(서버 등급 기준)</p>
        </div>
      </div>

      {/* ④ 기본 정보 */}
      <SectionTitle>기본 정보</SectionTitle>
      <InfoList
        className="rounded-xl border bg-card p-5 shadow-xs"
        items={[
          ["기기 시리얼", serial ? <MaskedSerial serial={serial} /> : "—"],
          ["렌탈 참조번호", rental.data?.renterRef ?? "—"],
          ["렌탈 상태", rental.data ? RENTAL_STATUS_LABEL[rental.data.status] : "—"],
          ["검사 시점", checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} · ${CHECKPOINT_STATUS_LABEL[checkpoint.status]}` : "없음"],
          ["검사 시각", checkpoint ? formatDateTime(checkpoint.occurredAt) : "—"],
          ["판정 규칙", data?.ruleVersion ?? "—"],
        ]}
      />

      {/* ⑤ 검사 사진 */}
      {checkpoint && !reviewing && (
        <>
          <SectionTitle>검사 사진</SectionTitle>
          <Photos checkpointId={checkpointId} inspection={data} />
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className={buttonVariants({ variant: "outline" })} to={back.path}>
          <ArrowLeft aria-hidden="true" />
          {back.label}
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} to={`/admin/rentals/${rentalId}`} state={{ serial }}>
          렌탈 상세
        </Link>
      </div>
    </section>
  );
}

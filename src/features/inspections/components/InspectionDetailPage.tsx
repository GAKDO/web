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
} from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { formatDateTime } from "../../../shared/ui/format";
import { RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { useRental } from "../../rentals/api/rentals";
import { useCheckpointInspection, useCheckpointMedia } from "../api/inspections";
import { faceGrids, photoDefectsOf, textureOverlays } from "../model/photos";
import { formatConfidence, formatMm, repairOf, verdictOf, type Verdict } from "../model/verdict";
import { PhotoGrid, TextureList } from "./PhotoGrid";

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
}

const fromPhotoDefect = (d: PhotoDefect): DefectRow => ({
  id: d.defectId,
  classLabel: DEFECT_CLASS_LABEL[d.class],
  where: [CAPTURE_FACE_LABEL[d.face], `${CAPTURE_CAMERA_LABEL[d.camera]} · ${CAPTURE_LIGHT_LABEL[d.light]}`],
  confidence: d.confidence,
});

const fromDefect = (d: Defect): DefectRow => ({
  id: d.defectId,
  classLabel: DEFECT_CLASS_LABEL[d.class],
  where: [CAPTURE_FACE_LABEL[d.face]],
  confidence: d.confidence,
  lengthMm: d.lengthMm,
  areaMm2: d.areaMm2,
  note: DEFECT_SOURCE_LABEL[d.source],
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
        <span>신뢰도 {formatConfidence(row.confidence)}</span>
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
  // 빠른 검사(QUICK)는 면 사진이 없고 흠집이 원본 사진 px(photoDefects)라 원본 사진 격자로 간다.
  // 정합 세트(FULL)는 원본 사진(photos)이 함께 와도 표준 좌표 흠집(defects)이 사라지지 않게 면 사진을 먼저 고른다
  if (photoDefects.length > 0 || (photos.length > 0 && textures.length === 0)) return <PhotoGrid grids={faceGrids(photos, photoDefects)} />;
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
  const title = checkpoint ? `${serial} ${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사 결과` : `${serial} 검사 결과`.trim();

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
  const photoDefects = photoDefectsOf(data);
  const rows = photoDefects.length > 0 ? photoDefects.map(fromPhotoDefect) : (data?.defects ?? []).map(fromDefect);

  const repair = repairOf(verdict);
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

      {/* ② 문제 항목 요약 */}
      {data && (
        <section aria-labelledby="summary-title">
          <SectionTitle id="summary-title">문제 항목 요약 · 흠집 {rows.length}개</SectionTitle>
          {rows.length === 0 ? (
            // 흠집 목록이 비어도 등급이 B~D일 수 있다(근거만 있음). "문제 없음"은 A 등급일 때만 쓴다
            <p className={cn("rounded-xl border px-4 py-3 font-semibold", verdict.kind === "ok" ? "border-success/40 bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{verdict.kind === "ok" ? "✔ 발견된 문제 없음" : "등록된 흠집 위치 없음 · 판정 근거는 아래 최종 판정을 봐 주세요"}</p>
          ) : (
            <>
              {photoDefects.length > 0 && <p className="text-sm text-muted-foreground">사진마다 따로 센 수입니다. 조명만 다른 사진에 겹친 같은 흠집은 등급을 매길 때 하나로 봅니다.</p>}
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
        <div className={cn(BOX_BASE, VERDICT_BOX[verdict.kind])} role="status" aria-label="판정">
          <p className={BOX_LABEL}>판정</p>
          <p className={VERDICT_TITLE}>
            {VERDICT_MARK[verdict.kind]} {verdict.label}
          </p>
          {verdict.kind === "pending" && <p>부스 사진이 올라오고 등급이 매겨지면 여기에 보입니다.</p>}
          {verdict.kind === "none" && <p>이 렌탈에 그런 시점이 없습니다.</p>}
          {data?.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
        <div className={cn(BOX_BASE, repair.needed === null ? BOX.unknown : repair.needed ? BOX.bad : BOX.ok)} role="status" aria-label="수리 필요 여부">
          <p className={BOX_LABEL}>수리 필요 여부</p>
          <p className={VERDICT_TITLE}>
            {repair.needed === null ? "…" : repair.needed ? "✖" : "✔"} {repair.label}
          </p>
          <p className={BOX_LABEL}>등급 A는 수리 필요 없음, B~D는 수리 필요(서버 등급 기준)</p>
        </div>
      </div>

      {/* ④ 기본 정보 */}
      <SectionTitle>기본 정보</SectionTitle>
      <InfoList
        className="rounded-xl border bg-card p-5 shadow-xs"
        items={[
          ["기기 시리얼", serial || "—"],
          ["렌탈 참조번호", rental.data?.renterRef ?? "—"],
          ["렌탈 상태", rental.data ? RENTAL_STATUS_LABEL[rental.data.status] : "—"],
          ["검사 시점", checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} · ${CHECKPOINT_STATUS_LABEL[checkpoint.status]}` : "없음"],
          ["검사 시각", checkpoint ? formatDateTime(checkpoint.occurredAt) : "—"],
          ["판정 규칙", data?.ruleVersion ?? "—"],
        ]}
      />

      {/* ⑤ 검사 사진 */}
      {checkpoint && (
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

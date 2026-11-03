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
import { useRental } from "../../rentals/api/rentals";
import { useCheckpointInspection, useCheckpointMedia } from "../api/inspections";
import { faceGrids, photoDefectsOf, textureOverlays } from "../model/photos";
import { formatConfidence, formatMm, verdictOf, type Verdict } from "../model/verdict";
import { PhotoGrid, TextureList } from "./PhotoGrid";

const VERDICT_BOX: Record<Verdict["kind"], string> = {
  ok: "verdict verdict-ok",
  bad: "verdict verdict-bad",
  none: "verdict verdict-unknown",
  pending: "verdict verdict-unknown",
  ungradable: "verdict verdict-unknown",
};
const VERDICT_MARK: Record<Verdict["kind"], string> = { ok: "✔", bad: "✖", none: "·", pending: "…", ungradable: "?" };

/** 흠집 카드 한 줄. 빠른 검사(원본 px)와 정합 세트(표준 좌표·mm) 둘 다 이 모양으로 */
interface DefectRow {
  id: string;
  classLabel: string;
  where: string[];
  confidence: number;
  /** undefined면 길이를 재지 않은 것(빠른 검사), null이면 읽지 못한 것 */
  lengthMm?: number | null;
  areaMm2?: number | null;
  note: string;
}

const fromPhotoDefect = (d: PhotoDefect): DefectRow => ({
  id: d.defectId,
  classLabel: DEFECT_CLASS_LABEL[d.class],
  where: [CAPTURE_FACE_LABEL[d.face], `${CAPTURE_CAMERA_LABEL[d.camera]} · ${CAPTURE_LIGHT_LABEL[d.light]}`],
  confidence: d.confidence,
  note: "원본 사진 px",
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
    <li className="card" aria-label={`흠집 ${index + 1}`}>
      <div className="card-main">
        <strong>
          {index + 1}. {row.classLabel}
        </strong>
        {row.where.map((w) => (
          <span key={w}>{w}</span>
        ))}
        <span>신뢰도 {formatConfidence(row.confidence)}</span>
        {row.lengthMm !== undefined && <span>길이 {formatMm(row.lengthMm)}</span>}
        {row.areaMm2 !== undefined && <span>면적 {formatMm(row.areaMm2, "mm²")}</span>}
        <span className="muted">{row.note}</span>
      </div>
    </li>
  );
}

/** 사진 보기: QUICK 세트는 원본 사진 격자 + 원본 px 흠집, 정합 세트는 면 사진 + 표준 좌표 흠집(spec 006 FR-004·005) */
function Photos({ checkpointId, inspection }: { checkpointId: string; inspection: Inspection | null }) {
  const media = useCheckpointMedia(checkpointId);
  if (media.isPending) return <p>사진 불러오는 중…</p>;
  if (media.isError) return <ErrorBanner message="사진을 불러오지 못했습니다." onRetry={() => void media.refetch()} />;
  const photoDefects = photoDefectsOf(inspection);
  const photos = media.data?.photos ?? [];
  const textures = media.data?.textures ?? [];
  // 빠른 검사(QUICK)는 면 사진이 없고 흠집이 원본 사진 px(photoDefects)라 원본 사진 격자로 간다.
  // 정합 세트(FULL)는 원본 사진(photos)이 함께 와도 표준 좌표 흠집(defects)이 사라지지 않게 면 사진을 먼저 고른다
  if (photoDefects.length > 0 || (photos.length > 0 && textures.length === 0)) return <PhotoGrid grids={faceGrids(photos, photoDefects)} />;
  if (media.data && textures.length > 0) return <TextureList overlays={textureOverlays(media.data, inspection?.defects ?? [])} />;
  return <p className="muted">사진이 아직 없습니다.</p>;
}

const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "불러오지 못했습니다.");

/** 한 시점의 검사 결과(spec 006 US2): 판정 상자·근거·흠집 카드·사진 위 흠집 겹쳐 보기 */
export function InspectionDetailPage() {
  const { rentalId = "", checkpointId = "" } = useParams();
  const hint = (useLocation().state as { serial?: string } | null)?.serial;
  const rental = useRental(rentalId);
  const checkpoint = rental.data?.checkpoints.find((c) => c.checkpointId === checkpointId) ?? null;
  // 이 렌탈의 시점일 때만 검사 결과를 읽는다. 다른 렌탈의 시점 주소를 넣어도 그 결과가 이 렌탈 아래 보이지 않는다
  const inspection = useCheckpointInspection(checkpoint?.checkpointId);
  const serial = rental.data?.serial || hint || "";
  const title = checkpoint ? `${serial} ${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사 결과` : `${serial} 검사 결과`.trim();

  if (rental.isPending || (checkpoint && inspection.isPending)) return <p>불러오는 중…</p>;
  const error = rental.isError ? rental.error : inspection.isError ? inspection.error : null;
  if (error) {
    return (
      <section className="narrow">
        <h1>{title}</h1>
        <ErrorBanner
          message={toMessage(error)}
          onRetry={() => {
            void rental.refetch();
            if (checkpoint) void inspection.refetch();
          }}
        />
        <Link to="/admin/inspections">검사 결과 목록으로</Link>
      </section>
    );
  }
  // 렌탈에 그 시점이 없으면(주소가 틀림) 읽지 않았으므로 검사 전으로 보인다
  const data = checkpoint ? (inspection.data ?? null) : null;
  const verdict = verdictOf(checkpoint, data);
  // 빠른 검사(QUICK)는 흠집이 photoDefects에만 있고 defects는 빈 배열이다(contracts 1.1.0)
  const photoDefects = photoDefectsOf(data);
  const rows = photoDefects.length > 0 ? photoDefects.map(fromPhotoDefect) : (data?.defects ?? []).map(fromDefect);

  return (
    <section>
      <h1>{title}</h1>
      {checkpoint && (
        <p className="muted">
          시점 상태 {CHECKPOINT_STATUS_LABEL[checkpoint.status]}
          {data?.ruleVersion && ` · 판정 규칙 ${data.ruleVersion}`}
        </p>
      )}
      <div className={VERDICT_BOX[verdict.kind]} role="status" aria-label="판정">
        <p className="verdict-title">
          {VERDICT_MARK[verdict.kind]} {verdict.label}
        </p>
        {verdict.kind === "pending" && <p>부스 사진이 올라오고 등급이 매겨지면 여기에 보입니다.</p>}
        {verdict.kind === "none" && <p>이 렌탈에 그런 시점이 없습니다.</p>}
        {data?.reasons.map((reason) => <p key={reason}>{reason}</p>)}
      </div>
      {data && (
        <>
          <h2>흠집 {rows.length}개</h2>
          {photoDefects.length > 0 && <p className="muted">사진마다 따로 센 수입니다. 조명만 다른 사진에 겹친 같은 흠집은 등급을 매길 때 하나로 봅니다.</p>}
          {rows.length === 0 ? (
            <p>흠집이 없습니다.</p>
          ) : (
            <ul className="cards" aria-label="흠집">
              {rows.map((row, i) => (
                <DefectCard key={row.id} row={row} index={i} />
              ))}
            </ul>
          )}
        </>
      )}
      {checkpoint && (
        <>
          <h2>사진</h2>
          <Photos checkpointId={checkpointId} inspection={data} />
        </>
      )}
      <p>
        <Link to="/admin/inspections">검사 결과 목록으로</Link> · <Link to={`/admin/rentals/${rentalId}`} state={{ serial }}>렌탈 상세</Link>
      </p>
    </section>
  );
}

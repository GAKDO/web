import { Link, useLocation, useParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import type { Defect } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL, CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, DEFECT_CLASS_LABEL, DEFECT_SOURCE_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useRental } from "../../rentals/api/rentals";
import { useCheckpointInspection } from "../api/inspections";
import { formatConfidence, formatMm, verdictOf, type Verdict } from "../model/verdict";

const VERDICT_BOX: Record<Verdict["kind"], string> = {
  ok: "verdict verdict-ok",
  bad: "verdict verdict-bad",
  none: "verdict verdict-unknown",
  pending: "verdict verdict-unknown",
  ungradable: "verdict verdict-unknown",
};
const VERDICT_MARK: Record<Verdict["kind"], string> = { ok: "✔", bad: "✖", none: "·", pending: "…", ungradable: "?" };

function DefectCard({ defect, index }: { defect: Defect; index: number }) {
  return (
    <li className="card" aria-label={`흠집 ${index + 1}`}>
      <div className="card-main">
        <strong>
          {index + 1}. {DEFECT_CLASS_LABEL[defect.class]}
        </strong>
        <span>{CAPTURE_FACE_LABEL[defect.face]}</span>
        <span>신뢰도 {formatConfidence(defect.confidence)}</span>
        <span>길이 {formatMm(defect.lengthMm)}</span>
        <span className="muted">{DEFECT_SOURCE_LABEL[defect.source]}</span>
      </div>
    </li>
  );
}

const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "불러오지 못했습니다.");

/** 한 시점의 검사 결과(spec 006 US2): 판정 상자·근거·흠집 카드. 사진·폴리곤은 contracts #20 뒤 붙인다 */
export function InspectionDetailPage() {
  const { rentalId = "", checkpointId = "" } = useParams();
  const hint = (useLocation().state as { serial?: string } | null)?.serial;
  const rental = useRental(rentalId);
  const inspection = useCheckpointInspection(checkpointId);
  const checkpoint = rental.data?.checkpoints.find((c) => c.checkpointId === checkpointId) ?? null;
  const serial = rental.data?.serial || hint || "";
  const title = checkpoint ? `${serial} ${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사 결과` : `${serial} 검사 결과`.trim();

  if (rental.isPending || inspection.isPending) return <p>불러오는 중…</p>;
  const error = rental.isError ? rental.error : inspection.isError ? inspection.error : null;
  if (error) {
    return (
      <section className="narrow">
        <h1>{title}</h1>
        <ErrorBanner
          message={toMessage(error)}
          onRetry={() => {
            void rental.refetch();
            void inspection.refetch();
          }}
        />
        <Link to="/admin/inspections">검사 결과 목록으로</Link>
      </section>
    );
  }
  // 렌탈에 그 시점이 없으면(주소가 틀림) 검사 전으로 보인다
  const data = inspection.data ?? null;
  const verdict = verdictOf(checkpoint, data);

  return (
    <section className="narrow">
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
          <h2>흠집 {data.defects.length}개</h2>
          {data.defects.length === 0 ? (
            <p>흠집이 없습니다.</p>
          ) : (
            <ul className="cards" aria-label="흠집">
              {data.defects.map((d, i) => (
                <DefectCard key={d.defectId} defect={d} index={i} />
              ))}
            </ul>
          )}
          {/* 사진 N장과 원본 px 폴리곤 겹쳐 보기(CheckpointMedia.photos·Defect.coordinateSpace)는 contracts #20 머지 뒤 다음 PR */}
          <p className="muted" role="note">
            사진과 흠집 위치 겹쳐 보기는 계약 반영 뒤 여기에 붙습니다.
          </p>
        </>
      )}
      <p>
        <Link to="/admin/inspections">검사 결과 목록으로</Link> · <Link to={`/admin/rentals/${rentalId}`} state={{ serial }}>렌탈 상세</Link>
      </p>
    </section>
  );
}

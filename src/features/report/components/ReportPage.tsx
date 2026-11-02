import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import type { TimelineCheckpoint } from "../../../shared/api/types";
import { CHAIN_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModel, useTimeline } from "../api/report";
import { CHECKPOINT_ORDER } from "../model/timeline";
import { CompareTable } from "./CompareTable";
import { TwinSection } from "./TwinSection";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";
}

function CheckpointCard({ type, checkpoint }: { type: TimelineCheckpoint["type"]; checkpoint: TimelineCheckpoint | undefined }) {
  const label = CHECKPOINT_TYPE_LABEL[type];
  if (!checkpoint) {
    return (
      <li className="card" aria-label={label}>
        <strong>{label}</strong> <span className="muted">아직 진행 전</span>
      </li>
    );
  }
  const sealed = checkpoint.status === "SEALED";
  return (
    <li className="card" aria-label={label}>
      <div className="card-main">
        <strong>{label}</strong>
        <span className={`badge${sealed ? "" : " badge-maintenance"}`}>{sealed ? "봉인됨" : "검사 중"}</span>
        {checkpoint.grade && <span>등급 {checkpoint.grade}</span>}
        {sealed && <span className={checkpoint.newDefectCount > 0 ? "warn" : undefined}>신규 흠집 {checkpoint.newDefectCount}개</span>}
        {checkpoint.sealedAt && <small>봉인 {formatDateTime(checkpoint.sealedAt)}</small>}
      </div>
    </li>
  );
}

/** 리포트를 열지 못했을 때. 403·404는 리포트 문맥 문장으로 바꾼다(FR-004) */
function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div role="alert" className="notice">
        <p>이 렌탈을 볼 권한이 없습니다.</p>
        <Link className="button-link" to="/my/rentals">
          내 렌탈 목록으로
        </Link>
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div role="alert" className="notice">
        <p>렌탈을 찾을 수 없습니다.</p>
        <Link className="button-link" to="/my/rentals">
          내 렌탈 목록으로
        </Link>
      </div>
    );
  }
  return <ErrorBanner message={error instanceof ApiError ? messageFor(error) : "리포트를 불러오지 못했습니다."} onRetry={onRetry} />;
}

/** 렌탈 리포트(FR-USR-03·RPT-03). 3D·비교표·진행률은 이 화면 안에 붙는다 */
export function ReportPage() {
  const { rentalId = "" } = useParams();
  const timeline = useTimeline(rentalId);
  const model = useDeviceModel(timeline.data?.modelCode);

  if (timeline.isPending) return <main className="page">리포트를 불러오는 중…</main>;
  if (timeline.isError) {
    return (
      <main className="page narrow">
        <h1>렌탈 리포트</h1>
        <ReportError error={timeline.error} onRetry={() => void timeline.refetch()} />
      </main>
    );
  }
  const data = timeline.data;
  return (
    <main className="page">
      <h1>{model.data?.name ?? data.modelCode} 리포트</h1>
      {data.chainStatus === "BROKEN" && (
        <p role="alert" className="error-banner">
          {CHAIN_STATUS_LABEL.BROKEN}. 관리자에게 문의해 주세요.
        </p>
      )}
      {data.verifyUrl && (
        <p>
          <a href={data.verifyUrl}>기록 검증하기</a>
        </p>
      )}
      <ol className="steps" aria-label="시점">
        {CHECKPOINT_ORDER.map((type) => (
          <CheckpointCard key={type} type={type} checkpoint={data.checkpoints.find((c) => c.type === type)} />
        ))}
      </ol>
      <TwinSection modelCode={data.modelCode} checkpoints={data.checkpoints} />
      <CompareTable checkpoints={data.checkpoints} />
    </main>
  );
}

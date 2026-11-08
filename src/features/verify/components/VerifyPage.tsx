import { useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/client";
import type { VerifyRecord, VerifyResponse } from "../../../shared/api/types";
import { CHECKPOINT_TYPE_LABEL, INSPECTION_GRADE_LABEL } from "../../../shared/codes/labels";
import { SiteBar } from "../../../shared/ui/SiteBar";
import { isVerifyToken, useVerify } from "../api/verify";
import { formatKst, shortHash } from "../format";

// 리포트의 검증 QR이 여는 공개 페이지(WE4, FR-INT-02). 로그인 없이 체인 정상 여부와 시점별 등급·지문을 보인다
export function VerifyPage() {
  const { verifyToken } = useParams();
  const query = useVerify(verifyToken);

  let content;
  if (!isVerifyToken(verifyToken) || (query.error instanceof ApiError && query.error.status === 404)) {
    content = <NotFound />;
  } else if (query.isError) {
    content = (
      <div className="error-banner" role="alert">
        <span>지금 확인할 수 없습니다. 잠시 뒤 다시 열어 주세요.</span>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
          다시 시도
        </button>
      </div>
    );
  } else if (query.data) {
    content = <VerifyResult result={query.data} />;
  } else {
    content = <p role="status">기록을 확인하는 중입니다…</p>;
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteBar />
      <main className="page narrow verify">
        <h1>TRACE 기록 검증</h1>
        {content}
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <section className="verdict verdict-unknown" role="alert">
      <p className="verdict-title">검증할 기록을 찾을 수 없습니다</p>
      <p>QR을 다시 찍거나 리포트에 적힌 주소를 그대로 열어 주세요.</p>
    </section>
  );
}

/** 계약 필드(valid·modelName·records·checkedAt)만 꺼내 쓴다(FR-008) */
function VerifyResult({ result }: { result: VerifyResponse }) {
  const { valid, modelName, checkedAt } = result;
  const records = [...result.records].sort((a, b) => a.seq - b.seq);
  return (
    <>
      {valid ? (
        <section className="verdict verdict-ok" role="status" aria-label="검증 결과">
          <p className="verdict-title">
            <span aria-hidden="true">✓</span> <span>기록이 그대로입니다</span>
          </p>
          <p>봉인된 뒤 바뀐 기록이 없습니다.</p>
        </section>
      ) : (
        <section className="verdict verdict-bad" role="alert" aria-label="검증 결과">
          <p className="verdict-title">
            <span aria-hidden="true">✕</span> <span>기록이 바뀌었습니다</span>
          </p>
          <p>봉인된 뒤 기록이 달라졌습니다. 이 리포트를 믿지 마세요.</p>
        </section>
      )}
      <p className="mt-4 mb-2">
        기종 <strong>{modelName}</strong>
      </p>
      {!valid && <p className="muted">서버가 가진 기록을 그대로 보여 줍니다(참고용).</p>}
      <ol className="steps" aria-label="시점 기록">
        {records.map((record) => (
          <RecordItem key={record.seq} record={record} />
        ))}
      </ol>
      <p className="muted text-sm">확인한 시각 {formatKst(checkedAt)}</p>
    </>
  );
}

function RecordItem({ record }: { record: VerifyRecord }) {
  const [open, setOpen] = useState(false);
  const label = CHECKPOINT_TYPE_LABEL[record.checkpointType];
  return (
    <li className="card verify-record" aria-label={label}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong>{label}</strong>
        <span className={record.grade ? "badge" : "badge badge-retired"}>{record.grade ? INSPECTION_GRADE_LABEL[record.grade] : "등급 없음"}</span>
        <span className="text-sm text-muted-foreground">봉인 {formatKst(record.signedAt)}</span>
      </div>
      <div className="grid gap-2 rounded-lg bg-muted px-3 py-2">
        <span className="text-xs text-muted-foreground">지문(SHA-256)</span>
        <code className="hash text-sm">{open ? record.payloadHash : shortHash(record.payloadHash)}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "접기" : "전체 보기"}
        </button>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(record.payloadHash)}>
          복사
        </button>
      </div>
    </li>
  );
}

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { CheckpointType, Rental } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCloseRental, useRental, useStartCheckpoint } from "../api/rentals";
import { nextAction } from "../nextAction";
import { CaptureLinkPanel } from "./CaptureLinkPanel";
import { PairingCodePanel } from "./PairingCodePanel";
import { formatDate } from "./RentalListPage";

const STEPS: CheckpointType[] = ["OUT", "RCV", "RET"];
const BEFORE: Record<CheckpointType, string> = { OUT: "출고를", RCV: "수령을", RET: "반납을" };

/** 꺼진 시작 버튼 옆에 붙일 이유 */
function reason(type: CheckpointType, action: ReturnType<typeof nextAction>): string {
  const prev = STEPS[STEPS.indexOf(type) - 1];
  if (action.kind === "waitSeal" && action.type === prev) return `${CHECKPOINT_TYPE_LABEL[prev]} 기록이 봉인되면 시작할 수 있습니다`;
  return `${BEFORE[prev]} 먼저 시작하세요`;
}
const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "요청을 처리하지 못했습니다.");

/** 출고 → 수령 → 반납 단계. 다음 단계 버튼만 켜고, 꺼진 버튼에는 이유를 붙인다(FR-022) */
function CheckpointSteps({ rental, serial, onError }: { rental: Rental; serial?: string; onError: (message: string | null) => void }) {
  const start = useStartCheckpoint(rental.rentalId);
  const action = nextAction(rental);
  return (
    <ol className="steps" aria-label="시점">
      {STEPS.map((type) => {
        const checkpoint = rental.checkpoints.find((c) => c.type === type);
        const isNext = action.kind === "start" && action.type === type;
        return (
          <li key={type} className="card" aria-label={CHECKPOINT_TYPE_LABEL[type]}>
            <strong>{CHECKPOINT_TYPE_LABEL[type]}</strong>
            {checkpoint ? (
              <>
                <span className={`badge${checkpoint.status === "SEALED" ? "" : " badge-maintenance"}`}>{CHECKPOINT_STATUS_LABEL[checkpoint.status]}</span>
                {/* 수령은 고객이 폰으로 찍는다. 시점을 시작한 뒤 촬영 전(OPEN)에만 QR을 만든다(WE2 US1) */}
                {type === "RCV" && checkpoint.status === "OPEN" && (
                  <CaptureLinkPanel rentalId={rental.rentalId} checkpointId={checkpoint.checkpointId} />
                )}
                {/* 진단 에이전트는 시점마다 붙는다. 봉인 전(OPEN)에만 코드를 만든다 */}
                {checkpoint.status === "OPEN" && (
                  <PairingCodePanel key={`${rental.rentalId}:${checkpoint.checkpointId}`} rentalId={rental.rentalId} checkpointId={checkpoint.checkpointId} deviceSerial={serial} />
                )}
              </>
            ) : (
              <>
                <Button
                  busy={start.isPending && isNext}
                  disabled={!isNext || start.isPending}
                  onClick={() => {
                    onError(null);
                    start.mutate(type, { onError: (e) => onError(toMessage(e)) });
                  }}
                >
                  {CHECKPOINT_TYPE_LABEL[type]} 시작
                </Button>
                {!isNext && rental.status !== "CLOSED" && <small>{reason(type, action)}</small>}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function RentalDetailPage() {
  const { rentalId = "" } = useParams();
  const hint = (useLocation().state as { serial?: string } | null)?.serial;
  const rental = useRental(rentalId);
  const close = useCloseRental(rentalId);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rental.isPending) return <p>불러오는 중…</p>;
  // 이미 받은 상세가 있으면 다시 읽기(3초 폴링)가 실패해도 화면을 지우지 않는다
  const data = rental.data;
  if (!data) return <ErrorBanner message={toMessage(rental.error)} onRetry={() => void rental.refetch()} />;
  const action = nextAction(data);
  // 시리얼은 렌탈 상세(계약 1.0.0)에서 오고, 없거나 빈 값이면 목록·등록 화면이 넘긴 값을 쓴다
  const serial = data.serial || hint;

  return (
    <section className="narrow">
      <h1>렌탈 {serial ?? ""}</h1>
      <p>
        대여자 참조 번호 {data.renterRef} · <span className="badge">{RENTAL_STATUS_LABEL[data.status]}</span> · 만든 날 {formatDate(data.createdAt)}
      </p>
      {rental.isError && <ErrorBanner message={toMessage(rental.error)} onRetry={() => void rental.refetch()} />}
      {error && <ErrorBanner message={error} />}
      <CheckpointSteps rental={data} serial={serial} onError={setError} />
      {data.checkpoints.length > 0 && (
        <p>
          <Link to={`/my/rentals/${data.rentalId}`}>리포트 보기</Link>
        </p>
      )}
      {action.kind === "waitSeal" && action.type === "RET" && (
        <p role="status">반납 기록이 봉인되면 종료할 수 있습니다. 지금 반납 시점: {CHECKPOINT_STATUS_LABEL[action.status]}</p>
      )}
      {action.kind === "closed" ? (
        <p role="status">종료된 렌탈입니다.</p>
      ) : (
        <div className="row">
          <Button onClick={() => void rental.refetch()}>새로 고침</Button>
          <Button disabled={action.kind !== "close"} onClick={() => setAsking(true)}>
            렌탈 종료
          </Button>
        </div>
      )}
      {asking && (
        <ConfirmDialog
          message="이 렌탈을 종료할까요? 종료한 렌탈은 다시 열 수 없습니다."
          confirmLabel="렌탈 종료"
          busy={close.isPending}
          onCancel={() => setAsking(false)}
          onConfirm={() =>
            close.mutate(undefined, {
              onSettled: () => setAsking(false),
              onSuccess: () => setError(null),
              onError: (e) => setError(toMessage(e)),
            })
          }
        />
      )}
    </section>
  );
}

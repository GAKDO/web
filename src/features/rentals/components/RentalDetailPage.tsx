import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { CheckpointType, Rental } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCloseRental, useRental, useStartCheckpoint } from "../api/rentals";
import { nextAction } from "../nextAction";

const STEPS: CheckpointType[] = ["OUT", "RCV", "RET"];
const BEFORE: Record<CheckpointType, string> = { OUT: "출고를", RCV: "수령을", RET: "반납을" };

/** 꺼진 시작 버튼 옆에 붙일 이유 */
function reason(type: CheckpointType, action: ReturnType<typeof nextAction>): string {
  const prev = STEPS[STEPS.indexOf(type) - 1];
  if (action.kind === "waitSeal" && action.type === prev) return `${CHECKPOINT_TYPE_LABEL[prev]} 기록이 봉인되면 시작할 수 있습니다`;
  return `${BEFORE[prev]} 먼저 시작하세요`;
}
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");
const toMessage = (e: unknown) => (e instanceof ApiError ? messageFor(e) : "요청을 처리하지 못했습니다.");

/** 출고 → 수령 → 반납 단계. 다음 단계 버튼만 켜고, 꺼진 버튼에는 이유를 붙인다(FR-022) */
function CheckpointSteps({ rental, onError }: { rental: Rental; onError: (message: string | null) => void }) {
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
              <span className={`badge${checkpoint.status === "SEALED" ? "" : " badge-maintenance"}`}>{CHECKPOINT_STATUS_LABEL[checkpoint.status]}</span>
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
  const serial = (useLocation().state as { serial?: string } | null)?.serial;
  const rental = useRental(rentalId);
  const close = useCloseRental(rentalId);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rental.isPending) return <p>불러오는 중…</p>;
  if (rental.isError) return <ErrorBanner message={toMessage(rental.error)} onRetry={() => void rental.refetch()} />;
  const data = rental.data;
  const action = nextAction(data);

  return (
    <section className="narrow">
      <h1>렌탈 {serial ?? ""}</h1>
      <p>
        대여자 참조 번호 {data.renterRef} · <span className="badge">{RENTAL_STATUS_LABEL[data.status]}</span> · 만든 날 {formatDate(data.createdAt)}
      </p>
      {error && <ErrorBanner message={error} />}
      <CheckpointSteps rental={data} onError={setError} />
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

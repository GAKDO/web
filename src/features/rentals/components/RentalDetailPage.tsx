import { maskSerial } from "../../../shared/ui/maskSerial";
import { MaskedSerial } from "../../../shared/ui/MaskedSerial";
import { PageHeader, SectionTitle } from "../../../shared/ui/PageHeader";
import { InfoList } from "../../../shared/ui/InfoList";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { CheckpointType, Rental } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL, RENTAL_STATUS_LABEL } from "../../../shared/codes/labels";
import { isArchived } from "../../../shared/config/features";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCloseRental, useRental, useStartCheckpoint } from "../api/rentals";
import { useRentalLive, type LiveState } from "../api/useRentalLive";
import { nextAction } from "../nextAction";
import { BoothIdsPanel } from "./BoothIdsPanel";
import { CaptureLinkPanel } from "./CaptureLinkPanel";
import { CheckpointDiagnostics } from "./DiagnosticsPanel";
import { formatDate, RENTAL_STATUS_VARIANT } from "./RentalListPage";
import { InspectionHistory } from "../../inspections/components/InspectionHistory";
import { formatDateTime } from "../../../shared/ui/format";

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
  // MVP(11/3, A 답변)는 렌탈당 출고 검사 1번이라 수령·반납 시작 버튼을 숨긴다. 이미 시작한 시점은 그대로 보인다
  const steps = STEPS.filter((type) => type === "OUT" || !isArchived("laterCheckpoints") || rental.checkpoints.some((c) => c.type === type));
  return (
    <ol className="m-0 grid list-none gap-2 p-0" aria-label="시점">
      {steps.map((type) => {
        const checkpoint = rental.checkpoints.find((c) => c.type === type);
        const isNext = action.kind === "start" && action.type === type;
        return (
          <li key={type} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs" aria-label={CHECKPOINT_TYPE_LABEL[type]}>
            <strong className="min-w-12">{CHECKPOINT_TYPE_LABEL[type]}</strong>
            {checkpoint ? (
              <>
                <Badge variant={checkpoint.status === "SEALED" ? "success" : "warning"}>{CHECKPOINT_STATUS_LABEL[checkpoint.status]}</Badge>
                {/* 수령은 고객이 폰으로 찍는다. 시점을 시작한 뒤 촬영 전(OPEN)에만 QR을 만든다(WE2 US1). MVP 배포에서는 보관(숨김) */}
                {type === "RCV" && checkpoint.status === "OPEN" && !isArchived("phoneCapture") && (
                  <CaptureLinkPanel rentalId={rental.rentalId} checkpointId={checkpoint.checkpointId} />
                )}
                {/* 수령·반납도 부스 빠른 검사로 찍는다(11/4, capture가 시점 종류를 앞 시점 수로 정함). 폰 촬영을 숨긴 배포에서만 안내 */}
                {type !== "OUT" && checkpoint.status === "OPEN" && isArchived("phoneCapture") && (
                  <small className="text-muted-foreground">부스 빠른 검사 목록에서 이 기기를 누르거나 위 부스 코드를 넣어 찍으세요</small>
                )}
                {/* 진단 에이전트는 시점마다 붙는다. 봉인 전에만 코드를 만들고, 올라온 진단은 봉인 뒤에도 보인다. MVP 배포에서는 보관(숨김) */}
                {!isArchived("diagnostics") && (
                  <CheckpointDiagnostics rentalId={rental.rentalId} checkpointId={checkpoint.checkpointId} open={checkpoint.status === "OPEN"} serial={serial} />
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
                {!isNext && rental.status !== "CLOSED" && <small className="text-muted-foreground">{reason(type, action)}</small>}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const LIVE_TEXT: Record<LiveState, string> = {
  live: "실시간 반영 중",
  connecting: "실시간 연결 중…",
  polling: "자동으로 다시 읽는 중",
};

/** 화면이 스스로 바뀐다는 표시. SSE가 붙으면 '실시간', 아니면 주기적 다시 읽기 */
function LiveBadge({ state }: { state: LiveState }) {
  return (
    <span className="inline-flex items-center gap-2 self-center text-sm text-muted-foreground">
      <span aria-hidden="true" className={`size-2 rounded-full ${state === "live" ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
      {LIVE_TEXT[state]}
    </span>
  );
}

export function RentalDetailPage() {
  const { rentalId = "" } = useParams();
  const hint = (useLocation().state as { serial?: string } | null)?.serial;
  const rental = useRental(rentalId);
  // 종료된 렌탈은 더 바뀌지 않으므로 실시간 연결을 열지 않는다
  const live = useRentalLive(rentalId, !!rental.data && rental.data.status === "OPEN");
  const close = useCloseRental(rentalId);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rental.isPending) return <p className="text-muted-foreground">불러오는 중…</p>;
  // 이미 받은 상세가 있으면 다시 읽기(3초 폴링)가 실패해도 화면을 지우지 않는다
  const data = rental.data;
  if (!data) return <ErrorBanner message={toMessage(rental.error)} onRetry={() => void rental.refetch()} />;
  const action = nextAction(data);
  const laterArchived = isArchived("laterCheckpoints");
  // 시리얼은 렌탈 상세(계약 1.0.0)에서 오고, 없거나 빈 값이면 목록·등록 화면이 넘긴 값을 쓴다
  const serial = data.serial || hint;
  // 연결 QR은 시점 하나에 묶여 발급된다(계약). 촬영은 하지 않으므로 가장 최근 시점을 쓴다
  const claimCheckpoint = data.checkpoints.at(-1);

  return (
    <section>
      <PageHeader
        title={`렌탈 ${serial ? maskSerial(serial) : ""}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            대여자 참조 번호 {data.renterRef} · <Badge variant={RENTAL_STATUS_VARIANT[data.status]}>{RENTAL_STATUS_LABEL[data.status]}</Badge> · 만든 날{" "}
            {formatDate(data.createdAt)}
          </span>
        }
      />
      {rental.isError && <ErrorBanner message={toMessage(rental.error)} onRetry={() => void rental.refetch()} />}
      {error && <ErrorBanner message={error} />}
      <SectionTitle>렌탈 기본 정보</SectionTitle>
      <InfoList
        className="rounded-xl border bg-card p-5 shadow-xs"
        items={[
          ["대여자 참조 번호", data.renterRef],
          [
            "기기 시리얼",
            // 시리얼은 가려 두고 눈 아이콘으로 보인다(11/6 팀 요청). 기기 상세(렌탈 이력)로 가는 링크를 옆에 둔다
            <span key="serial" className="inline-flex flex-wrap items-center gap-x-3">
              {serial ? <MaskedSerial serial={serial} /> : "—"}
              <Link className="text-info underline-offset-4 hover:underline" to={`/admin/devices/${data.deviceId}`}>
                기기 보기
              </Link>
            </span>,
          ],
          ["현재 상태", RENTAL_STATUS_LABEL[data.status]],
          ["시작", formatDateTime(data.startedAt)],
          ["종료", formatDateTime(data.endedAt)],
        ]}
      />
      <SectionTitle>부스에 넣을 ID</SectionTitle>
      <BoothIdsPanel rental={data} />
      <InspectionHistory rental={data} serial={serial} />
      <SectionTitle>시점 진행</SectionTitle>
      <CheckpointSteps rental={data} serial={serial} onError={setError} />
      {/* 3D 리포트(WE3)는 MVP 배포에서 보관(숨김) */}
      {data.checkpoints.length > 0 && !isArchived("report") && (
        <p className="mt-4">
          <Link className="text-info underline-offset-4 hover:underline" to={`/my/rentals/${data.rentalId}`}>
            리포트 보기
          </Link>
        </p>
      )}
      {/* 폰 촬영을 숨긴 배포에서도 같은 QR로 렌탈을 고객 계정에 연결한다(11/6). 연결하면 고객 내 렌탈에 리포트가 보인다 */}
      {claimCheckpoint && data.status !== "CLOSED" && isArchived("phoneCapture") && !isArchived("report") && (
        <>
          <SectionTitle>고객 계정 연결</SectionTitle>
          <CaptureLinkPanel key={claimCheckpoint.checkpointId} rentalId={data.rentalId} checkpointId={claimCheckpoint.checkpointId} purpose="claim" />
        </>
      )}
      {action.kind === "waitSeal" && action.type === "RET" && !laterArchived && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          반납 기록이 봉인되면 종료할 수 있습니다. 지금 반납 시점: {CHECKPOINT_STATUS_LABEL[action.status]}
        </p>
      )}
      {action.kind === "closed" ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          종료된 렌탈입니다.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => void rental.refetch()}>
            <RefreshCw aria-hidden="true" />
            새로 고침
          </Button>
          <LiveBadge state={live} />
          {/* 종료는 반납 봉인 뒤에만 되므로 수령·반납을 보관한 MVP에서는 숨긴다(다시 검사하려면 렌탈을 새로 만든다) */}
          {!laterArchived && (
            <Button disabled={action.kind !== "close"} onClick={() => setAsking(true)}>
              렌탈 종료
            </Button>
          )}
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

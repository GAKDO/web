import { useEffect, useRef } from "react";
import { ApiError } from "../../../shared/api/problem";
import { formatDateTime } from "../../../shared/ui/format";
import { useDiagnostics } from "../../report/api/report";
import { diagnosticsReadings, flagText, type Reading } from "../../report/model/compare";
import { PairingCodePanel } from "./PairingCodePanel";

function ReadingText({ reading }: { reading: Reading }) {
  return reading.kind === "value" ? <>{reading.text}</> : <span className="text-muted-foreground">읽지 못함 ({reading.reason})</span>;
}

/**
 * 이 시점에 진단 에이전트가 올린 진단(DI1·AG1). 리포트(report-server) 없이 렌탈 상세에서 바로 본다.
 * live: 봉인 전 시점이면 진단이 올라올 때까지 5초마다 다시 읽는다.
 */
export function DiagnosticsPanel({ checkpointId, live }: { checkpointId: string; live: boolean }) {
  const diag = useDiagnostics(checkpointId, live ? 5_000 : undefined);
  // 봉인으로 폴링이 멈출 때 아직 진단이 없으면 마지막으로 한 번 더 읽는다(봉인 직전에 올라온 진단을 놓치지 않게)
  const wasLive = useRef(live);
  const { refetch, data } = diag;
  useEffect(() => {
    if (wasLive.current && !live && !data) void refetch();
    wasLive.current = live;
  }, [live, data, refetch]);
  if (diag.isPending) return null;
  const notFound = diag.isError && diag.error instanceof ApiError && diag.error.status === 404;
  if (notFound) {
    return (
      <p className="w-full text-sm text-muted-foreground">
        아직 올라온 진단이 없습니다{live ? " (올라오면 바로 보입니다)" : ""}.
      </p>
    );
  }
  if (diag.isError) {
    return (
      <p className="w-full text-sm text-muted-foreground">
        진단을 불러오지 못했습니다.{" "}
        <button type="button" className="underline" onClick={() => void diag.refetch()}>
          다시 불러오기
        </button>
      </p>
    );
  }
  const { current, flags } = diag.data;
  const { battery, cycles, ssd } = diagnosticsReadings(current);
  const flagLabels = [...new Set(flags.map((f) => f.kind))].map(flagText);
  return (
    <section aria-label="진단 결과" className="w-full rounded-lg border p-3 text-sm">
      <strong>진단 결과</strong>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">수집 시각</dt>
        <dd>{formatDateTime(current.collectedAt)}</dd>
        <dt className="text-muted-foreground">배터리 최대 용량</dt>
        <dd>
          <ReadingText reading={battery} />
        </dd>
        <dt className="text-muted-foreground">배터리 충전 횟수</dt>
        <dd>
          <ReadingText reading={cycles} />
        </dd>
        <dt className="text-muted-foreground">저장장치(SSD)</dt>
        <dd>
          <ReadingText reading={ssd} />
        </dd>
        <dt className="text-muted-foreground">점검 알림</dt>
        <dd>{flagLabels.length === 0 ? "없음" : flagLabels.join(", ")}</dd>
      </dl>
    </section>
  );
}

/**
 * 시점 칸의 진단 부분. 봉인 전(OPEN)이고 아직 진단이 없을 때만 페어링 코드를 만들 수 있다.
 * 시점당 진단은 한 번만 올라가므로(두 번째는 409) 진단이 올라오면 다 쓴 코드는 가린다.
 */
export function CheckpointDiagnostics({ rentalId, checkpointId, open, serial }: { rentalId: string; checkpointId: string; open: boolean; serial?: string }) {
  // DiagnosticsPanel과 같은 쿼리 키라 요청은 한 번만 나간다
  const diag = useDiagnostics(checkpointId, open ? 5_000 : undefined);
  // 조회가 끝나 진단이 없다고 확인된 뒤에만 코드를 만들 수 있게 한다(로딩 중에 눌러 쓸데없는 코드가 나가지 않게)
  const canPair = open && !diag.isPending && !diag.data;
  return (
    <>
      {canPair && <PairingCodePanel key={`${rentalId}:${checkpointId}`} rentalId={rentalId} checkpointId={checkpointId} deviceSerial={serial} />}
      {/* 폴링으로 결과가 바뀌면 화면 읽기 프로그램에 알린다. 알림 영역은 결과보다 먼저 있어야 한다 */}
      <div aria-live="polite" className="w-full">
        <DiagnosticsPanel checkpointId={checkpointId} live={open} />
      </div>
    </>
  );
}

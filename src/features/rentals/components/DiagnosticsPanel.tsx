import { useEffect, useRef } from "react";
import type { CheckpointDiagnostics } from "../../../shared/api/types";
import { formatDateTime } from "../../../shared/ui/format";
import { useDiagnostics } from "../../report/api/report";
import { diagnosticsReadings, flagText, type Reading } from "../../report/model/compare";
import { PairingCodePanel } from "./PairingCodePanel";

type BenchmarkMetric = CheckpointDiagnostics["current"]["benchmarks"][number]["metric"];

/** 벤치마크 이름과 단위. 에이전트가 재는 단위(CPU ops/s, 메모리·디스크 MB/s) 그대로 보인다 */
const BENCHMARK_LABEL: Record<BenchmarkMetric, [string, string]> = {
  CPU_SINGLE: ["CPU 단일 코어", "ops/s"],
  CPU_MULTI: ["CPU 멀티 코어", "ops/s"],
  MEM_COPY: ["메모리 복사", "MB/s"],
  DISK_READ: ["디스크 읽기", "MB/s"],
  DISK_WRITE: ["디스크 쓰기", "MB/s"],
};

function benchmarkText(median: number, unit: string): string {
  return `${Math.round(median).toLocaleString("ko-KR")} ${unit}`;
}

type RunChecks = NonNullable<CheckpointDiagnostics["current"]["checks"]>;

/**
 * 잠금·디스크 상태 한 줄(contracts 11/7 checks). 옛 에이전트 진단은 checks가 없어 null.
 * Windows는 활성화 잠금·OS 디스크 상태를 읽지 않으므로(계약상 늘 null) '모름'이 아니라 '해당 없음'으로 보인다.
 */
export function checksText(checks: RunChecks | null | undefined, os?: CheckpointDiagnostics["current"]["os"]): string {
  if (!checks) return "확인 안 함 (이전 버전 에이전트)";
  const unread = (macOnly: boolean) => (macOnly && os === "WINDOWS" ? "해당 없음" : "모름");
  const lock = (v: RunChecks["activationLock"], macOnly: boolean) => (v === "ON" ? "켜짐" : v === "OFF" ? "꺼짐" : unread(macOnly));
  const health = checks.osDiskHealth === "WARNING" ? "경고" : checks.osDiskHealth === "OK" ? "정상" : unread(true);
  return `활성화 잠금 ${lock(checks.activationLock, true)} · 디스크 암호화 ${lock(checks.diskEncryption, false)} · OS 디스크 상태 ${health}`;
}

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
  // 첫 조회 전에만 비워 둔다. 다시 읽는 동안에는 지난 결과를 그대로 둬 화면이 깜빡이지 않게 한다
  if (!diag.isFetched) return null;
  if (diag.data === null) {
    return (
      <p className="w-full text-sm text-muted-foreground">
        아직 올라온 진단이 없습니다{live ? " (올라오면 바로 보입니다)" : ""}.
      </p>
    );
  }
  // 오류이거나, 오류 뒤 다시 읽는 중(데이터가 없어 status가 pending으로 돌아감)이면 오류 문장을 그대로 둔다
  if (!diag.data) {
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
        <dt className="text-muted-foreground">잠금·디스크 상태</dt>
        <dd>{checksText(current.checks, current.os)}</dd>
        <dt className="text-muted-foreground">점검 알림</dt>
        <dd>{flagLabels.length === 0 ? "없음" : flagLabels.join(", ")}</dd>
        {/* 벤치마크는 3회 중앙값. 전원이 없어 건너뛰면 비어 온다 */}
        <dt className="text-muted-foreground">벤치마크(3회 중앙값)</dt>
        <dd>
          {current.benchmarks.length === 0 ? (
            <span className="text-muted-foreground">측정 안 함 (전원 미연결 등)</span>
          ) : (
            <ul className="m-0 list-none p-0">
              {current.benchmarks.map((b) => (
                <li key={b.metric}>
                  {BENCHMARK_LABEL[b.metric][0]} {benchmarkText(b.median, BENCHMARK_LABEL[b.metric][1])}
                </li>
              ))}
            </ul>
          )}
        </dd>
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
  // isPending은 쓰지 않는다: 데이터가 없는 쿼리는 다시 읽을 때마다 pending으로 돌아가 코드 칸이 사라졌다 다시 생긴다
  const canPair = open && diag.isFetched && !diag.data;
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

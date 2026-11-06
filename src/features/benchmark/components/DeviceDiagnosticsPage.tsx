import { ArrowRight, RefreshCw, TriangleAlert, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { NativeSelect } from "@/components/ui/native-select";
import { CHECKPOINT_TYPE_LABEL, FLAG_LABEL, SKIPPED_REASON_LABEL } from "../../../shared/codes/labels";
import type { RunSummary } from "../../../shared/api/types";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { formatDateTime } from "../../../shared/ui/format";
import { maskSerial } from "../../../shared/ui/maskSerial";
import { useDeviceModels, useDevices } from "../../devices/api/devices";
import { useDeviceDiagnostics } from "../api/deviceDiagnostics";
import {
  changePct,
  type DiagnosedCheckpoint,
  DROP_WARN_PCT,
  formatPct,
  formatValue,
  METRIC_LABEL,
  METRICS,
  metricValue,
  pairOf,
} from "../model/diagnostics";
import { ColumnChart } from "./ColumnChart";

// 분류 색(검증한 기본 팔레트 1·2번): 렌탈 전(출고) 파랑, 렌탈 후 주황. 떨어짐 표시는 상태 색 + 아이콘 + 글자
const BEFORE = "#2a78d6";
const AFTER = "#eb6834";

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="grid gap-0.5">
        <h3 className="m-0 text-base font-semibold tracking-tight">{title}</h3>
        {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** 변화 표시. 클수록 좋은 값이 기준보다 많이 떨어지면 빨간 아이콘 + '떨어짐' */
function Change({ pct, higherIsBetter = true }: { pct: number | null; higherIsBetter?: boolean }) {
  const bad = pct !== null && (higherIsBetter ? pct <= DROP_WARN_PCT : pct >= -DROP_WARN_PCT);
  return (
    <span className={bad ? "inline-flex items-center gap-1 font-semibold text-destructive" : "text-muted-foreground"}>
      {bad && <TrendingDown aria-hidden="true" className="size-3.5" />}
      {formatPct(pct)}
      {bad && " 떨어짐"}
    </span>
  );
}

/** 전·후 두 막대. 같은 눈금(둘 중 큰 값 또는 고정 최댓값) */
function PairBars({ before, after, max, unit = "" }: { before: number | null; after: number | null; max?: number; unit?: string }) {
  const top = max ?? Math.max(before ?? 0, after ?? 0, 1);
  const row = (label: string, v: number | null, color: string) => (
    <div className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="h-3 rounded-r-[4px] bg-muted">
        {v !== null && <span className="block h-3 rounded-r-[4px]" style={{ width: `${Math.min(100, (v / top) * 100)}%`, background: color }} />}
      </span>
      <span className="text-right font-medium tabular-nums">
        {formatValue(v)}
        {v !== null ? unit : ""}
      </span>
    </div>
  );
  return (
    <div className="grid gap-1.5">
      {row("렌탈 전", before, BEFORE)}
      {row("렌탈 후", after, AFTER)}
    </div>
  );
}

const pointLabel = (d: DiagnosedCheckpoint) => `${d.renterRef} ${CHECKPOINT_TYPE_LABEL[d.type]}`;

function Compare({ before, after }: { before: DiagnosedCheckpoint | null; after: DiagnosedCheckpoint | null }) {
  const b: RunSummary | undefined = before?.diagnostics.current;
  const a: RunSummary | undefined = after?.diagnostics.current;
  const flags = after?.diagnostics.flags ?? [];
  const metrics = METRICS.filter((m) => metricValue(b, m) !== null || metricValue(a, m) !== null);
  const ssdRows: { label: string; key: "percentUsed" | "availableSparePct" | "powerOnHours" | "mediaErrors"; unit: string; higherIsBetter: boolean }[] = [
    { label: "사용률", key: "percentUsed", unit: "%", higherIsBetter: false },
    { label: "남은 예비 공간", key: "availableSparePct", unit: "%", higherIsBetter: true },
    { label: "전원 켠 시간", key: "powerOnHours", unit: "시간", higherIsBetter: false },
    { label: "미디어 오류", key: "mediaErrors", unit: "건", higherIsBetter: false },
  ];
  const changedParts = b && a ? a.components.filter((c) => !b.components.some((x) => x.kind === c.kind && x.identifier === c.identifier)) : [];

  return (
    <div className="grid gap-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: BEFORE }} />
          렌탈 전 · {before ? `${CHECKPOINT_TYPE_LABEL[before.type]} ${formatDateTime(b?.collectedAt)}` : "출고 진단 없음"}
        </span>
        <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: AFTER }} />
          렌탈 후 · {after ? `${CHECKPOINT_TYPE_LABEL[after.type]} ${formatDateTime(a?.collectedAt)}` : "아직 반납 진단 없음"}
        </span>
      </p>
      {flags.length > 0 && (
        <ul aria-label="점검 플래그" className="m-0 grid list-none gap-1 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-sm">
          {flags.map((f) => (
            <li key={f.kind} className="flex items-center gap-2 text-destructive">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {FLAG_LABEL[f.kind]}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.length ? (
          metrics.map((m) => (
            <Card key={m} title={METRIC_LABEL[m]} note="에이전트 벤치마크 중앙값, 클수록 빠릅니다">
              <PairBars before={metricValue(b, m)} after={metricValue(a, m)} />
              <p className="m-0 text-xs">
                변화 <Change pct={changePct(metricValue(b, m), metricValue(a, m))} />
              </p>
            </Card>
          ))
        ) : (
          <Card title="벤치마크">
            <Empty>이 렌탈의 진단에 벤치마크 결과가 없습니다(전원 미연결 등으로 건너뜀).</Empty>
          </Card>
        )}
        <Card title="배터리" note="최대 용량 = 지금 완충 용량 ÷ 설계 용량">
          {b?.battery || a?.battery ? (
            <>
              <PairBars before={b?.battery?.maxCapacityPct ?? null} after={a?.battery?.maxCapacityPct ?? null} max={100} unit="%" />
              <p className="m-0 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span>
                  용량 변화 <Change pct={changePct(b?.battery?.maxCapacityPct, a?.battery?.maxCapacityPct)} />
                </span>
                <span className="tabular-nums">
                  충전 횟수 {b?.battery?.cycleCount ?? "—"} → {a?.battery?.cycleCount ?? "—"}
                </span>
              </p>
            </>
          ) : (
            <Empty>배터리 값이 없습니다.</Empty>
          )}
        </Card>
        <Card title="SSD" note="SMART 값(읽을 권한이 없으면 비어 있음)">
          {b?.ssd || a?.ssd ? (
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 font-medium">항목</th>
                  <th className="py-1 font-medium">렌탈 전</th>
                  <th className="py-1 font-medium">렌탈 후</th>
                </tr>
              </thead>
              <tbody>
                {ssdRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1">{r.label}</td>
                    <td className="py-1">{b?.ssd?.[r.key] ?? "—"}</td>
                    <td className="py-1">{a?.ssd?.[r.key] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              {(b?.ssd?.skippedReason || a?.ssd?.skippedReason) && (
                <caption className="caption-bottom pt-2 text-left text-muted-foreground">
                  읽지 못함: {SKIPPED_REASON_LABEL[(a?.ssd?.skippedReason ?? b?.ssd?.skippedReason)!]}
                </caption>
              )}
            </table>
          ) : (
            <Empty>SSD 값이 없습니다.</Empty>
          )}
        </Card>
      </div>
      {changedParts.length > 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          렌탈 후 새로 보인 부품: {changedParts.map((c) => `${c.kind} ${c.identifier}`).join(", ")}
        </p>
      )}
    </div>
  );
}

/**
 * 성능(11/6): 기기마다 진단 에이전트 결과를 렌탈 전(출고)과 렌탈 후(반납, 없으면 수령)로 비교하고,
 * 그 기기의 진단 기록을 시점 순으로 그린다. 서버가 준 진단 요약만 쓴다(GET /diagnostics/checkpoints/{id})
 */
export function DeviceDiagnosticsPage() {
  const [params, setParams] = useSearchParams();
  const devices = useDevices({ limit: 100 });
  const models = useDeviceModels();
  const deviceList = devices.data?.pages.flatMap((p) => p.items) ?? [];
  const deviceId = params.get("deviceId") ?? deviceList[0]?.deviceId;
  const data = useDeviceDiagnostics(deviceId);
  const rentalIds = [...new Set(data.diagnosed.map((d) => d.rentalId))].reverse();
  const rentalId = params.get("rentalId") && rentalIds.includes(params.get("rentalId")!) ? params.get("rentalId")! : rentalIds[0];
  const pair = rentalId ? pairOf(rentalId, data.diagnosed) : { before: null, after: null };
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  const historyMetric = METRICS.find((m) => data.diagnosed.some((d) => metricValue(d.diagnostics.current, m) !== null));
  const select = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === "deviceId") next.delete("rentalId");
    setParams(next, { replace: true });
  };

  return (
    <section>
      <PageHeader
        title="성능"
        description="기기마다 진단 에이전트 결과(벤치마크·배터리·SSD)를 렌탈 전(출고)과 렌탈 후(반납)로 비교합니다."
        actions={
          <Button onClick={data.refetch}>
            <RefreshCw aria-hidden="true" />
            새로 고침
          </Button>
        }
      />
      {devices.isError && <ErrorBanner message="기기 목록을 불러오지 못했습니다." onRetry={() => void devices.refetch()} />}
      {data.failed > 0 && <ErrorBanner message={`진단 ${data.failed}건을 불러오지 못해 빼고 보여 줍니다.`} onRetry={data.refetch} />}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          기기
          <NativeSelect value={deviceId ?? ""} onChange={(e) => select("deviceId", e.target.value)} disabled={!deviceList.length}>
            {deviceList.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.assetNo ? `${d.assetNo} · ` : ""}{maskSerial(d.serial)} · {modelName(d.modelCode)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          렌탈
          <NativeSelect value={rentalId ?? ""} onChange={(e) => select("rentalId", e.target.value)} disabled={!rentalIds.length}>
            {rentalIds.map((id) => {
              const first = data.diagnosed.find((d) => d.rentalId === id);
              return (
                <option key={id} value={id}>
                  {first?.renterRef} · {first ? formatDateTime(first.createdAt) : ""}
                </option>
              );
            })}
          </NativeSelect>
        </label>
      </div>

      {!deviceId ? (
        <Empty>{devices.isPending ? "불러오는 중…" : "등록된 기기가 없습니다."}</Empty>
      ) : data.loading && !data.diagnosed.length ? (
        <Empty>불러오는 중…</Empty>
      ) : !data.diagnosed.length ? (
        <Empty>이 기기는 아직 진단을 올린 적이 없습니다. 렌탈 상세의 페어링 코드로 진단 에이전트를 실행하면 여기에 나옵니다.</Empty>
      ) : (
        <>
          <h2 className="mt-2 mb-3 text-lg font-semibold tracking-tight">렌탈 전·후 비교</h2>
          <Compare before={pair.before} after={pair.after} />
          <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">이 기기의 진단 기록</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="배터리 최대 용량" note="진단을 올린 시점마다(오래된 것부터)">
              <ColumnChart
                title="배터리 최대 용량"
                unit="%"
                columns={data.diagnosed.map((d) => ({ label: pointLabel(d), values: [d.diagnostics.current.battery?.maxCapacityPct ?? 0] }))}
                series={[{ name: "최대 용량", color: BEFORE }]}
              />
            </Card>
            {historyMetric && (
              <Card title={`${METRIC_LABEL[historyMetric]} 기록`} note="진단을 올린 시점마다 벤치마크 중앙값(오래된 것부터)">
                <ColumnChart
                  title={METRIC_LABEL[historyMetric]}
                  unit=""
                  columns={data.diagnosed.map((d) => ({ label: pointLabel(d), values: [metricValue(d.diagnostics.current, historyMetric) ?? 0] }))}
                  series={[{ name: METRIC_LABEL[historyMetric], color: BEFORE }]}
                />
              </Card>
            )}
          </div>
        </>
      )}
    </section>
  );
}

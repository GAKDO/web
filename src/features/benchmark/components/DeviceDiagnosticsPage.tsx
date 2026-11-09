import { ArrowRight, Equal, RefreshCw, TriangleAlert, TrendingDown, TrendingUp } from "lucide-react";
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
import { useDevice, useDeviceModels, useDevices } from "../../devices/api/devices";
import { useDeviceDiagnostics } from "../api/deviceDiagnostics";
import {
  type BenchmarkMetric,
  CHANGE_LEVEL_LABEL,
  changeLevel,
  type ChangeLevel,
  changePct,
  type DiagnosedCheckpoint,
  formatDelta,
  formatPct,
  formatValue,
  METRIC_LABEL,
  METRICS,
  METRIC_UNIT,
  metricValue,
  pairOf,
} from "../model/diagnostics";
import { ColumnChart } from "./ColumnChart";

// 분류 색(검증한 기본 팔레트 1·2번): 렌탈 전(출고) 파랑, 렌탈 후 주황. 떨어짐 표시는 상태 색 + 아이콘 + 글자
const BEFORE = "#2a78d6";
const AFTER = "#eb6834";

function Card({ title, note, badge, children }: { title: string; note?: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="m-0 text-base font-semibold tracking-tight">{title}</h3>
          {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

// 변화 판단마다 색·아이콘·글자(색만으로 구분하지 않게 글자를 함께)
const LEVEL_STYLE: Record<ChangeLevel, string> = {
  better: "bg-success-soft text-success",
  same: "bg-muted text-muted-foreground",
  slight: "bg-warning-soft text-warning",
  worse: "bg-destructive-soft text-destructive",
};

function LevelIcon({ level }: { level: ChangeLevel }) {
  const cls = "size-3.5";
  if (level === "same") return <Equal aria-hidden="true" className={cls} />;
  return level === "better" ? <TrendingUp aria-hidden="true" className={cls} /> : <TrendingDown aria-hidden="true" className={cls} />;
}

/** 변화 배지: "−8.3% 조금 낮아짐". 3% 안은 비슷함, 10% 넘게 나빠지면 떨어짐(빨강) */
function Change({ pct, higherIsBetter = true, large = false }: { pct: number | null; higherIsBetter?: boolean; large?: boolean }) {
  const level = changeLevel(pct, higherIsBetter);
  if (level === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tabular-nums ${LEVEL_STYLE[level]} ${large ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      <LevelIcon level={level} />
      {formatPct(pct)} {CHANGE_LEVEL_LABEL[level]}
    </span>
  );
}

/** 변화율 막대: 가운데 0에서 왼쪽(나빠짐)·오른쪽(좋아짐)으로 ±20%까지. 막대 길이 차이가 작아도 변화가 보이게 */
function DeltaBar({ pct, higherIsBetter = true }: { pct: number | null; higherIsBetter?: boolean }) {
  if (pct === null) return null;
  const gain = higherIsBetter ? pct : -pct;
  const level = changeLevel(pct, higherIsBetter)!;
  const width = Math.min(50, (Math.abs(gain) / 20) * 50);
  const color = { better: "var(--success)", same: "var(--muted-foreground)", slight: "var(--warning)", worse: "var(--destructive)" }[level];
  return (
    <div className="grid gap-0.5" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-muted">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/40" />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{ background: color, width: `${Math.max(width, 1)}%`, left: gain >= 0 ? "50%" : `${50 - Math.max(width, 1)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>나빠짐 −20%</span>
        <span>0</span>
        <span>좋아짐 +20%</span>
      </div>
    </div>
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

/** 한눈에 보기: 지표마다 전·후·차이·판단을 한 표로(11/9 민서 요청: 비교 차이를 명확하게) */
function Summary({ b, a, metrics }: { b: RunSummary; a: RunSummary; metrics: BenchmarkMetric[] }) {
  const rows: { label: string; before: number | null; after: number | null; unit: string; deltaUnit: string; higherIsBetter: boolean }[] = [
    ...metrics.map((m) => ({
      label: METRIC_LABEL[m], before: metricValue(b, m), after: metricValue(a, m), unit: METRIC_UNIT[m],
      deltaUnit: METRIC_UNIT[m], higherIsBetter: true,
    })),
    {
      label: "배터리 최대 용량", before: b.battery?.maxCapacityPct ?? null, after: a.battery?.maxCapacityPct ?? null, unit: "%",
      deltaUnit: "%p", higherIsBetter: true,
    },
  ];
  const levels = rows.map((r) => changeLevel(changePct(r.before, r.after), r.higherIsBetter));
  const worse = levels.filter((l) => l === "worse" || l === "slight").length;
  return (
    <section aria-label="한눈에 보기" className="grid gap-2 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-base font-semibold tracking-tight">한눈에 보기</h3>
        <p className="m-0 text-sm">
          {worse === 0 ? (
            <span className="font-semibold text-success">렌탈 전과 비교해 낮아진 항목이 없습니다</span>
          ) : (
            <span className="font-semibold text-warning">낮아진 항목 {worse}개</span>
          )}
          <span className="text-muted-foreground"> · ±3% 안은 측정할 때마다 생기는 흔들림이라 비슷함으로 봅니다</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">항목</th>
              <th className="py-1.5 text-right font-medium">렌탈 전</th>
              <th className="py-1.5 text-right font-medium">렌탈 후</th>
              <th className="py-1.5 text-right font-medium">차이</th>
              <th className="py-1.5 pl-3 font-medium">판단</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right">{formatValue(r.before)}{r.before !== null && r.unit === "%" ? "%" : ""}</td>
                <td className="py-1.5 text-right">{formatValue(r.after)}{r.after !== null && r.unit === "%" ? "%" : ""}</td>
                <td className="py-1.5 text-right font-semibold">{formatDelta(r.before, r.after, r.deltaUnit)}</td>
                <td className="py-1.5 pl-3">
                  <Change pct={changePct(r.before, r.after)} higherIsBetter={r.higherIsBetter} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
      {b && a && <Summary b={b} a={a} metrics={metrics} />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metrics.length ? (
          metrics.map((m) => (
            <Card
              key={m}
              title={METRIC_LABEL[m]}
              note="에이전트 벤치마크 중앙값, 클수록 빠릅니다"
              badge={<Change large pct={changePct(metricValue(b, m), metricValue(a, m))} />}
            >
              <PairBars before={metricValue(b, m)} after={metricValue(a, m)} />
              <DeltaBar pct={changePct(metricValue(b, m), metricValue(a, m))} />
              <p className="m-0 text-xs text-muted-foreground">
                차이 <strong className="font-semibold text-foreground tabular-nums">{formatDelta(metricValue(b, m), metricValue(a, m), METRIC_UNIT[m])}</strong>
              </p>
            </Card>
          ))
        ) : (
          <Card title="벤치마크">
            <Empty>이 렌탈의 진단에 벤치마크 결과가 없습니다(전원 미연결 등으로 건너뜀).</Empty>
          </Card>
        )}
        <Card
          title="배터리"
          note="최대 용량 = 지금 완충 용량 ÷ 설계 용량"
          badge={<Change large pct={changePct(b?.battery?.maxCapacityPct, a?.battery?.maxCapacityPct)} />}
        >
          {b?.battery || a?.battery ? (
            <>
              <PairBars before={b?.battery?.maxCapacityPct ?? null} after={a?.battery?.maxCapacityPct ?? null} max={100} unit="%" />
              <p className="m-0 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                <span>
                  용량 차이{" "}
                  <strong className="font-semibold text-foreground tabular-nums">
                    {formatDelta(b?.battery?.maxCapacityPct, a?.battery?.maxCapacityPct, "%p")}
                  </strong>
                </span>
                <span className="tabular-nums">
                  충전 횟수 {b?.battery?.cycleCount ?? "—"} → {a?.battery?.cycleCount ?? "—"} ({formatDelta(b?.battery?.cycleCount, a?.battery?.cycleCount, "회")})
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
                  <th className="py-1 font-medium">차이</th>
                </tr>
              </thead>
              <tbody>
                {ssdRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1">{r.label}</td>
                    <td className="py-1">{b?.ssd?.[r.key] ?? "—"}</td>
                    <td className="py-1">{a?.ssd?.[r.key] ?? "—"}</td>
                    <td className="py-1 font-medium">{formatDelta(b?.ssd?.[r.key], a?.ssd?.[r.key], r.unit)}</td>
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
  const firstPage = devices.data?.pages.flatMap((p) => p.items) ?? [];
  const urlDeviceId = params.get("deviceId");
  // 기기 상세에서 넘어온 기기가 첫 100대에 없으면 따로 읽어 선택지에 더한다(다른 기기가 고른 것처럼 보이지 않게)
  const urlDevice = useDevice(urlDeviceId ?? "", !!urlDeviceId && !devices.isPending && !firstPage.some((d) => d.deviceId === urlDeviceId));
  const deviceList = urlDevice.data && !firstPage.some((d) => d.deviceId === urlDevice.data.deviceId) ? [urlDevice.data, ...firstPage] : firstPage;
  const deviceId = urlDeviceId ?? deviceList[0]?.deviceId;
  const data = useDeviceDiagnostics(deviceId);
  const rentalIds = [...new Set(data.diagnosed.map((d) => d.rentalId))].reverse();
  const urlRentalId = params.get("rentalId");
  const rentalId = urlRentalId && rentalIds.includes(urlRentalId) ? urlRentalId : rentalIds[0];
  const pair = rentalId ? pairOf(rentalId, data.diagnosed) : { before: null, after: null };
  const modelName = (code: string) => models.data?.find((m) => m.modelCode === code)?.name ?? code;
  // 측정을 건너뛴 시점은 0으로 그리지 않고 뺀다
  const batteryColumns = data.diagnosed.flatMap((d) => {
    const v = d.diagnostics.current.battery?.maxCapacityPct;
    return v == null ? [] : [{ label: pointLabel(d), values: [v] }];
  });
  const historyMetric = METRICS.find((m) => data.diagnosed.some((d) => metricValue(d.diagnostics.current, m) !== null));
  const select = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === "deviceId") next.delete("rentalId");
    setParams(next, { replace: true, preventScrollReset: true });
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
            {deviceId && !deviceList.some((d) => d.deviceId === deviceId) && <option value={deviceId}>불러오는 중…</option>}
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
            {!rentalIds.length && <option value="">{data.loading ? "불러오는 중…" : "진단한 렌탈 없음"}</option>}
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
            {batteryColumns.length > 0 && (
              <Card title="배터리 최대 용량" note="진단을 올린 시점마다(오래된 것부터), 측정을 건너뛴 시점은 뺌">
                <ColumnChart title="배터리 최대 용량" unit="%" columns={batteryColumns} series={[{ name: "최대 용량", color: BEFORE }]} />
              </Card>
            )}
            {historyMetric && (
              <Card title={`${METRIC_LABEL[historyMetric]} 기록`} note="진단을 올린 시점마다 벤치마크 중앙값(오래된 것부터)">
                <ColumnChart
                  title={METRIC_LABEL[historyMetric]}
                  unit=""
                  columns={data.diagnosed.flatMap((d) => {
                    const v = metricValue(d.diagnostics.current, historyMetric);
                    return v === null ? [] : [{ label: pointLabel(d), values: [v] }];
                  })}
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

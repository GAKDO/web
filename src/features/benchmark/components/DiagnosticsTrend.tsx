import { ChartLine } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceDiagnostics } from "../api/deviceDiagnostics";
import { trendSeries } from "../model/trend";
import { TrendChart } from "./TrendChart";

/**
 * 기기의 날짜별 진단 추이(배터리·충전 횟수·SSD·벤치마크 중앙값). 진단은 시점마다 diagnostics-server에 쌓이므로
 * 이 기기의 렌탈 → 시점 → 진단을 모아 수집 시각 순으로 그린다. 봉인 전(OPEN) 시점의 진단은 봉인된 뒤 들어간다
 */
export function DiagnosticsTrend({ deviceId }: { deviceId: string }) {
  const data = useDeviceDiagnostics(deviceId);
  if (data.loading && !data.diagnosed.length) return <p className="text-sm text-muted-foreground">진단 기록을 모으는 중…</p>;
  const series = trendSeries(data.diagnosed);
  return (
    <section aria-label="진단 추이" className="grid gap-3">
      {data.failed > 0 && <ErrorBanner message={`진단 ${data.failed}건을 불러오지 못해 빼고 보여 줍니다.`} onRetry={data.refetch} />}
      {series.length === 0 ? (
        <p className="m-0 rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">아직 봉인된 시점의 진단이 없어 추이를 그릴 수 없습니다.</p>
      ) : (
        <>
          <p className="m-0 text-xs text-muted-foreground">
            이 기기에서 진단한 {data.diagnosed.length}번을 날짜 순으로 보여 줍니다(다른 렌탈 포함). 점에 마우스를 올리면 시각과 시점이 보입니다.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {series.map((s) => (
              <div key={s.key} className="rounded-xl border bg-card p-4 shadow-xs">
                <TrendChart series={s} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** 렌탈 상세용: 누를 때만 기기의 렌탈·진단을 모은다(상세를 열 때마다 이력 전체를 읽지 않게) */
export function DiagnosticsTrendToggle({ deviceId }: { deviceId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <div>
        <Button aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <ChartLine aria-hidden="true" />
          {open ? "진단 추이 접기" : "진단 추이 보기"}
        </Button>
      </div>
      {open && <DiagnosticsTrend deviceId={deviceId} />}
    </div>
  );
}

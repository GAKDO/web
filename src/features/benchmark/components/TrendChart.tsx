import { formatDateTime } from "../../../shared/ui/format";
import { formatValue } from "../model/diagnostics";
import { axisLabels, type TrendSeries, tooltipAlign, trendDomain } from "../model/trend";

const TOOLTIP_ALIGN = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" } as const;

// 단일 계열이라 범례 없이 제목이 계열 이름이다. 색은 성능 화면의 '렌탈 전' 파랑(검증한 기본 팔레트 1번)
const LINE = "#2a78d6";

const valueText = (v: number | null, unit: string) => (v === null ? "읽지 못함" : `${formatValue(v)}${unit}`);

/**
 * 지표 하나의 날짜별 꺾은선. 점에 마우스·키보드 초점을 두면 그 진단의 시각·시점·값이 뜨고, '표로 보기'로 같은 값을 읽는다.
 * 선은 SVG(가로세로 늘어나도 굵기 2px 유지), 점은 HTML로 겹쳐 그려 늘어나지 않게 한다
 */
export function TrendChart({ series, height = 120 }: { series: TrendSeries; height?: number }) {
  const { points, unit } = series;
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const [lo, hi] = trendDomain(values);
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  // 읽지 못한 진단에서 선을 끊는다
  const segments: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) segments.push([]);
    else {
      if (segments.length === 0) segments.push([]);
      segments[segments.length - 1].push({ i, v: p.value });
    }
  });
  const last = [...points].reverse().find((p) => p.value !== null);
  const axis = axisLabels(points);

  return (
    <figure className="m-0 grid gap-2" aria-label={`${series.label} 추이`}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{series.label}</span>
        {last && <span className="text-sm font-medium tabular-nums">최근 {valueText(last.value, unit)}</span>}
      </figcaption>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[0.6875rem] text-muted-foreground tabular-nums" style={{ height }} aria-hidden="true">
          <span>{formatValue(hi)}</span>
          <span>{formatValue(lo)}</span>
        </div>
        <div className="relative min-w-0 flex-1 border-b border-border px-3" style={{ height }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
          <div className="relative h-full">
            <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {segments
                .filter((s) => s.length > 1)
                .map((s) => (
                  <polyline
                    key={s[0].i}
                    fill="none"
                    stroke={LINE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    points={s.map(({ i, v }) => `${x(i)},${100 - y(v)}`).join(" ")}
                  />
                ))}
            </svg>
            {points.map((p, i) =>
              p.value === null ? null : (
                <div
                  key={`${p.collectedAt}-${i}`}
                  tabIndex={0}
                  aria-label={`${p.label} ${p.where}: ${valueText(p.value, unit)}`}
                  className="group absolute z-[1] flex size-6 -translate-x-1/2 translate-y-1/2 cursor-default items-center justify-center outline-none"
                  style={{ left: `${x(i)}%`, bottom: `${y(p.value)}%` }}
                >
                  <span aria-hidden="true" className="block size-2.5 rounded-full border-2 border-card group-focus-visible:ring-2 group-focus-visible:ring-ring" style={{ background: LINE }} />
                  <span role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden ${TOOLTIP_ALIGN[tooltipAlign(x(i))]} rounded-md border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md group-hover:block group-focus-visible:block`}>
                    <strong className="block">{valueText(p.value, unit)}</strong>
                    <span className="block text-muted-foreground">{formatDateTime(p.collectedAt)}</span>
                    <span className="block text-muted-foreground">{p.where}</span>
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="relative ml-7 h-4 px-3 text-[0.6875rem] text-muted-foreground" aria-hidden="true">
        <div className="relative h-full">
          {points.map((p, i) => (
            <span key={`${p.collectedAt}-${i}`} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i)}%` }}>
              {axis[i]}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">표로 보기</summary>
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead>
            <tr>
              <th className="py-1 font-medium">수집 시각</th>
              <th className="py-1 font-medium">시점</th>
              <th className="py-1 font-medium">값</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={`${p.collectedAt}-${i}`} className="border-t">
                <td className="py-1">{formatDateTime(p.collectedAt)}</td>
                <td className="py-1">{p.where}</td>
                <td className="py-1">{valueText(p.value, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

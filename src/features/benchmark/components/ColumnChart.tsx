import { cn } from "@/lib/utils";

export interface Series {
  name: string;
  /** 막대 색(CSS 색). 상태(문제 없음·있음)는 상태 색, 그 밖은 분류 색 순서대로 */
  color: string;
}

export interface Column {
  label: string;
  /** series와 같은 순서의 값. 여럿이면 아래부터 쌓는다 */
  values: number[];
}

/** 위 눈금 값: 최댓값을 2·4·10 단위로 올린다. 건수라 가운데 눈금(절반)도 정수가 되게 짝수로 맞춘다 */
export function niceMax(max: number): number {
  if (max <= 2) return 2;
  const step = 10 ** Math.floor(Math.log10(max));
  const n = [1, 2, 4, 6, 8, 10].find((m) => m * step >= max) ?? 10;
  return Math.max(2, n * step);
}

/**
 * 세로 막대 그래프(쌓기 지원). 막대에 마우스·키보드 초점을 두면 값이 뜨고, 아래 '표로 보기'로 같은 값을 읽을 수 있다.
 * 두 계열 이상이면 범례를 늘 보인다(색만으로 구분하지 않음)
 */
export function ColumnChart({
  title,
  columns,
  series,
  unit = "건",
  height = 160,
  target,
}: {
  title: string;
  columns: Column[];
  series: Series[];
  unit?: string;
  height?: number;
  /** 목표선(예: 부스 판정 30초). 눈금은 목표선이 보이게 잡는다 */
  target?: { value: number; label: string };
}) {
  const totals = columns.map((c) => Math.round(c.values.reduce((s, v) => s + v, 0) * 10) / 10);
  const top = niceMax(Math.max(0, target?.value ?? 0, ...totals));
  return (
    <figure className="m-0 grid gap-3" aria-label={title}>
      {series.length > 1 && (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground" aria-label="범례">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[0.6875rem] text-muted-foreground tabular-nums" style={{ height }} aria-hidden="true">
          <span>{top}</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>
        <div className="relative flex min-w-0 flex-1 items-end gap-1 border-b border-border" style={{ height }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
          {target && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[1] border-t-2 border-foreground/70" style={{ bottom: (target.value / top) * (height - 2) }}>
              <span className="absolute right-0 bottom-0.5 rounded-sm bg-card/90 px-1 text-[0.6875rem] font-medium text-foreground">{target.label}</span>
            </div>
          )}
          {columns.map((c, i) => (
            <div key={`${c.label}-${i}`} tabIndex={0} aria-label={`${c.label}: ${series.map((s, j) => `${s.name} ${c.values[j]}${unit}`).join(", ")}`} className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col justify-end outline-none">
              <div className="mx-auto flex w-full max-w-10 flex-col-reverse gap-[2px]">
                {c.values.map((v, j) =>
                  v > 0 ? (
                    <span key={series[j].name} className={cn("block w-full", j === c.values.length - 1 || c.values.slice(j + 1).every((x) => x === 0) ? "rounded-t-[4px]" : "")} style={{ height: (v / top) * (height - 2), background: series[j].color }} />
                  ) : null,
                )}
              </div>
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md group-hover:block group-focus-visible:block">
                <strong className="block">{c.label}</strong>
                {series.map((s, j) => (
                  <span key={s.name} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-sm" style={{ background: s.color }} />
                    {s.name} {c.values[j]}
                    {unit}
                  </span>
                ))}
                {series.length > 1 && <span className="text-muted-foreground">합계 {totals[i]}{unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-7 flex gap-1 text-[0.6875rem] text-muted-foreground" aria-hidden="true">
        {columns.map((c, i) => (
          <span key={`${c.label}-${i}`} className="min-w-0 flex-1 truncate text-center">
            {c.label}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">표로 보기</summary>
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead>
            <tr>
              <th className="py-1 font-medium">구분</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={`${c.label}-${i}`} className="border-t">
                <td className="py-1">{c.label}</td>
                {c.values.map((v, j) => (
                  <td key={series[j].name} className="py-1">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

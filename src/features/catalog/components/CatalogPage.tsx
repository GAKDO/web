import { ArrowDownNarrowWide, ArrowUpNarrowWide, Search } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useCatalog } from "../api/catalog";
import { filterRows, SORT_OPTIONS, sortRows, type CatalogRow, type SortDir, type SortKey } from "../model/catalog";
import { compact, DASH, percent } from "../model/format";
import { AvailabilityBadge, GradeBadge } from "./Badges";

// 공개 보유 노트북 목록(11/8 민서 요청): 로그인 없이 회사가 가진 노트북의 흠집 수·외관 등급·배터리·벤치마크를 비교한다.
// 검색·정렬은 주소(?q=&sort=&dir=&available=1)에 남겨 뒤로 가기·링크 공유 때 그대로 돌아온다.

const KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.key));

function useListState() {
  const [params, setParams] = useSearchParams();
  const sort = (KEYS.has(params.get("sort") ?? "") ? params.get("sort") : "defectCount") as SortKey;
  const option = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0];
  const dir = (params.get("dir") === "asc" || params.get("dir") === "desc" ? params.get("dir") : option.better) as SortDir;
  const q = params.get("q") ?? "";
  const availableOnly = params.get("available") === "1";
  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    // 쿼리만 바꾸는 이동은 스크롤을 맨 위로 올리지 않는다
    setParams(p, { replace: true, preventScrollReset: true });
  };
  return { sort, dir, q, availableOnly, update };
}

/** 열 머리: 누르면 그 항목으로 정렬, 다시 누르면 방향을 바꾼다 */
function SortHeader({ k, label, sort, dir, onSort, className }: { k: SortKey; label: string; sort: SortKey; dir: SortDir; onSort(k: SortKey): void; className?: string }) {
  const active = sort === k;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-2 py-2 text-right font-medium whitespace-nowrap", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex cursor-pointer items-center gap-1 rounded px-1 hover:text-foreground", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
        <span aria-hidden="true" className={cn("text-[0.625rem]", !active && "opacity-30")}>
          {active && dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function DeviceName({ row }: { row: CatalogRow }) {
  const d = row.device;
  return (
    <>
      <Link to={`/devices/${d.deviceId}`} className="font-semibold text-foreground no-underline hover:underline">
        {d.modelName}
      </Link>
      <span className="block text-xs text-muted-foreground">
        No.{row.shortId}
        {d.color ? ` · ${d.color}` : ""}
        {d.spec?.ramGb ? ` · ${d.spec.ramGb}GB` : ""}
        {d.spec?.ssdGb ? ` · ${d.spec.ssdGb}GB SSD` : ""}
      </span>
    </>
  );
}

function DefectCell({ count }: { count: number | null }) {
  if (count === null) return <span className="text-muted-foreground">{DASH}</span>;
  return <span className={cn("font-semibold tabular-nums", count === 0 ? "text-emerald-700 dark:text-emerald-400" : "")}>{count}개</span>;
}

function Table({ rows, sort, dir, onSort }: { rows: CatalogRow[]; sort: SortKey; dir: SortDir; onSort(k: SortKey): void }) {
  const h = { sort, dir, onSort };
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">보유 노트북 비교표. 열 머리를 누르면 그 항목으로 정렬합니다.</caption>
        <thead className="border-b bg-muted/40 text-xs">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
              <button type="button" onClick={() => onSort("model")} className="cursor-pointer hover:text-foreground">
                노트북
              </button>
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium text-muted-foreground">
              상태
            </th>
            <SortHeader k="grade" label="등급" {...h} />
            <SortHeader k="defectCount" label="흠집" {...h} />
            <SortHeader k="maxCapacityPct" label="배터리" {...h} />
            <SortHeader k="cycleCount" label="충전 횟수" {...h} />
            <SortHeader k="CPU_SINGLE" label="CPU 단일" {...h} />
            <SortHeader k="CPU_MULTI" label="CPU 멀티" {...h} />
            <SortHeader k="MEM_COPY" label="메모리" {...h} />
            <SortHeader k="DISK_READ" label="읽기" {...h} />
            <SortHeader k="DISK_WRITE" label="쓰기" {...h} className="pr-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.device.deviceId} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-3 py-2.5">
                <DeviceName row={row} />
              </td>
              <td className="px-2 py-2.5">
                <AvailabilityBadge device={row.device} />
              </td>
              <td className="px-2 py-2.5 text-right">
                <GradeBadge grade={row.grade} />
              </td>
              <td className="px-2 py-2.5 text-right">
                <DefectCell count={row.defectCount} />
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{percent(row.maxCapacityPct)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{row.cycleCount === null ? DASH : `${row.cycleCount}회`}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{compact(row.bench.CPU_SINGLE)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{compact(row.bench.CPU_MULTI)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{compact(row.bench.MEM_COPY)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{compact(row.bench.DISK_READ)}</td>
              <td className="px-2 py-2.5 pr-3 text-right tabular-nums">{compact(row.bench.DISK_WRITE)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 폰(375px): 표 대신 카드. 정렬은 위의 고르기 상자로 한다 */
function Cards({ rows }: { rows: CatalogRow[] }) {
  return (
    <ul aria-label="보유 노트북" className="m-0 grid list-none gap-3 p-0">
      {rows.map((row) => (
        <li key={row.device.deviceId} className="relative rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DeviceName row={row} />
            </div>
            <AvailabilityBadge device={row.device} />
          </div>
          <dl className="m-0 mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">외관</dt>
              <dd className="m-0 mt-0.5">
                <GradeBadge grade={row.grade} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">흠집</dt>
              <dd className="m-0 mt-0.5">
                <DefectCell count={row.defectCount} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">배터리</dt>
              <dd className="m-0 mt-0.5 tabular-nums">{percent(row.maxCapacityPct)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">충전 횟수</dt>
              <dd className="m-0 mt-0.5 tabular-nums">{row.cycleCount === null ? DASH : `${row.cycleCount}회`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">CPU 단일</dt>
              <dd className="m-0 mt-0.5 tabular-nums">{compact(row.bench.CPU_SINGLE)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">디스크 읽기</dt>
              <dd className="m-0 mt-0.5 tabular-nums">{compact(row.bench.DISK_READ)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function CatalogPage() {
  const catalog = useCatalog();
  const { sort, dir, q, availableOnly, update } = useListState();
  const all = catalog.data?.rows ?? [];
  const rows = useMemo(() => sortRows(filterRows(all, { q, availableOnly }), sort, dir), [all, q, availableOnly, sort, dir]);
  const option = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0];
  const onSort = (k: SortKey) => {
    const better = SORT_OPTIONS.find((o) => o.key === k)?.better ?? "asc";
    update({ sort: k, dir: k === sort ? (dir === "asc" ? "desc" : "asc") : better });
  };
  const available = all.filter((r) => r.device.available).length;
  const clean = all.filter((r) => r.defectCount === 0).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="m-0 text-headline font-bold">보유 노트북</h1>
        <p className="m-0 mt-2 max-w-2xl text-muted-foreground">
          TRACE가 관리하는 노트북을 흠집 수, 외관 등급, 배터리, 성능으로 비교해 보세요. 노트북을 누르면 흠집 위치를 3D로 볼 수 있습니다.
        </p>
        {all.length > 0 && (
          <p className="m-0 mt-3 text-sm">
            전체 <strong>{all.length}대</strong> · 지금 대여 가능 <strong>{available}대</strong> · 흠집 없는 노트북 <strong>{clean}대</strong>
          </p>
        )}
      </header>

      <div role="search" className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block md:w-80">
          <span className="sr-only">노트북 검색</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="기종, CPU, 색상으로 찾기"
            className="h-10 w-full rounded-full border bg-background pr-4 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap text-muted-foreground">정렬</span>
            <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="h-10 rounded-full border bg-background px-3 text-sm">
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => update({ dir: dir === "asc" ? "desc" : "asc" })}
            aria-label={dir === "asc" ? `${option.label} 낮은 순, 누르면 높은 순` : `${option.label} 높은 순, 누르면 낮은 순`}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border bg-background px-3 text-sm whitespace-nowrap hover:bg-muted"
          >
            {dir === "asc" ? <ArrowUpNarrowWide aria-hidden="true" className="size-4" /> : <ArrowDownNarrowWide aria-hidden="true" className="size-4" />}
            {dir === "asc" ? "낮은 순" : "높은 순"}
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm md:ml-auto">
          <input type="checkbox" checked={availableOnly} onChange={(e) => update({ available: e.target.checked ? "1" : null })} className="size-4" />
          대여 가능한 것만
        </label>
      </div>

      <div className="mt-5">
        {catalog.isPending && <p role="status">노트북 목록을 불러오는 중…</p>}
        {catalog.isError && (
          <ErrorBanner message={catalog.error instanceof ApiError ? messageFor(catalog.error) : "목록을 불러오지 못했습니다."} onRetry={() => void catalog.refetch()} />
        )}
        {catalog.data?.partial && (
          <p role="status" className="m-0 mb-3 text-sm text-amber-700 dark:text-amber-400">
            흠집 또는 진단 값을 일부 불러오지 못해 빈칸으로 보입니다. 잠시 뒤 새로 고침해 주세요.
          </p>
        )}
        {catalog.isSuccess && rows.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{all.length === 0 ? "아직 등록된 노트북이 없습니다." : "조건에 맞는 노트북이 없습니다."}</p>
        )}
        {rows.length > 0 && (
          <>
            <div className="hidden md:block">
              <Table rows={rows} sort={sort} dir={dir} onSort={onSort} />
            </div>
            <div className="md:hidden">
              <Cards rows={rows} />
            </div>
          </>
        )}
      </div>

      <section aria-labelledby="catalog-how" className="mt-10 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
        <h2 id="catalog-how" className="sr-only">
          값을 읽는 법
        </h2>
        <p className="m-0 rounded-2xl border bg-card p-4">
          <strong className="block text-foreground">흠집 수</strong>
          부스에서 찍은 사진을 AI가 살피고, 관리자가 확인해 확정한 흠집만 셉니다. 같은 흠집이 여러 사진에 찍혀도 하나로 셉니다.
        </p>
        <p className="m-0 rounded-2xl border bg-card p-4">
          <strong className="block text-foreground">배터리·충전 횟수</strong>
          진단 프로그램이 읽은 값입니다. 최대 용량은 처음 용량 대비 지금 충전되는 양입니다.
        </p>
        <p className="m-0 rounded-2xl border bg-card p-4">
          <strong className="block text-foreground">성능</strong>
          같은 조건으로 세 번 잰 중앙값입니다. CPU는 초당 연산 수, 메모리·디스크는 초당 MB입니다.
        </p>
      </section>
    </main>
  );
}

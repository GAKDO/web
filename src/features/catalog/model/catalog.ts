import type { BenchmarkMetric, CatalogDevice, CatalogDiagnostics, CatalogInspectionSummary, DefectClass, Grade } from "../../../shared/api/types";

// 공개 보유 기기 목록(11/8 민서 요청): 기기(rental) + 최신 흠집 요약(capture) + 최신 진단(diagnostics)을 한 줄로 합치고,
// 검색·항목별 정렬을 화면 밖 순수 함수로 둔다(테스트하기 쉽게). 서버는 서로 부르지 않으므로 화면이 합친다(contracts #33).

/** 목록 한 줄. 값이 없으면 null(아직 검사·진단 전) */
export interface CatalogRow {
  device: CatalogDevice;
  /** 같은 기종끼리 구분하는 짧은 번호(deviceId 뒤 4자리). 시리얼은 공개하지 않는다 */
  shortId: string;
  inspection: CatalogInspectionSummary | null;
  diagnostics: CatalogDiagnostics | null;
  grade: Grade | null;
  defectCount: number | null;
  maxCapacityPct: number | null;
  cycleCount: number | null;
  ssdUsedPct: number | null;
  bench: Record<BenchmarkMetric, number | null>;
}

const METRICS: BenchmarkMetric[] = ["CPU_SINGLE", "CPU_MULTI", "MEM_COPY", "DISK_READ", "DISK_WRITE"];

/**
 * 기기마다 최신 상태를 고른다: 시점 목록(최근 것부터)에서 흠집 요약이 있는 첫 시점, 진단이 있는 첫 시점.
 * 흠집과 진단이 다른 시점일 수 있다(예: 반납은 부스만 찍고 진단은 출고 때만).
 */
export function mergeCatalog(devices: CatalogDevice[], inspections: CatalogInspectionSummary[], diagnostics: CatalogDiagnostics[]): CatalogRow[] {
  const ins = new Map(inspections.map((i) => [i.checkpointId, i]));
  const diag = new Map(diagnostics.map((d) => [d.checkpointId, d]));
  return devices.map((device) => {
    const inspection = firstOf(device, ins);
    const d = firstOf(device, diag);
    const bench = Object.fromEntries(METRICS.map((m) => [m, d?.benchmarks.find((b) => b.metric === m)?.median ?? null])) as Record<BenchmarkMetric, number | null>;
    return {
      device,
      shortId: device.deviceId.slice(-4).toUpperCase(),
      inspection,
      diagnostics: d,
      grade: inspection?.grade ?? null,
      defectCount: inspection?.defectCount ?? null,
      maxCapacityPct: d?.battery?.maxCapacityPct ?? null,
      cycleCount: d?.battery?.cycleCount ?? null,
      ssdUsedPct: d?.ssd?.percentUsed ?? null,
      bench,
    };
  });
}

function firstOf<T>(device: CatalogDevice, byCheckpoint: Map<string, T>): T | null {
  for (const c of device.checkpoints) {
    const hit = byCheckpoint.get(c.checkpointId);
    if (hit) return hit;
  }
  return null;
}

/** 시점 ID 전부(중복 없이). capture·diagnostics에 한 번에 100개씩 묻는다 */
export function checkpointIdsOf(devices: CatalogDevice[]): string[] {
  return [...new Set(devices.flatMap((d) => d.checkpoints.map((c) => c.checkpointId)))];
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type SortKey =
  | "grade"
  | "defectCount"
  | "maxCapacityPct"
  | "cycleCount"
  | "ssdUsedPct"
  | "CPU_SINGLE"
  | "CPU_MULTI"
  | "MEM_COPY"
  | "DISK_READ"
  | "DISK_WRITE"
  | "model";
export type SortDir = "asc" | "desc";

export interface SortOption {
  key: SortKey;
  label: string;
  /** 처음 누르면 이 방향: 좋은 것이 위로(흠집·충전 횟수는 적은 순, 배터리·성능은 높은 순) */
  better: SortDir;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "defectCount", label: "흠집 수", better: "asc" },
  { key: "grade", label: "외관 등급", better: "asc" },
  { key: "maxCapacityPct", label: "배터리 최대 용량", better: "desc" },
  { key: "cycleCount", label: "충전 횟수", better: "asc" },
  { key: "CPU_SINGLE", label: "CPU 단일 코어", better: "desc" },
  { key: "CPU_MULTI", label: "CPU 멀티 코어", better: "desc" },
  { key: "MEM_COPY", label: "메모리 속도", better: "desc" },
  { key: "DISK_READ", label: "디스크 읽기", better: "desc" },
  { key: "DISK_WRITE", label: "디스크 쓰기", better: "desc" },
  { key: "ssdUsedPct", label: "SSD 사용률", better: "asc" },
  { key: "model", label: "기종 이름", better: "asc" },
];

const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3 };

function valueOf(row: CatalogRow, key: SortKey): number | string | null {
  switch (key) {
    case "grade":
      return row.grade ? GRADE_RANK[row.grade] : null;
    case "defectCount":
      return row.defectCount;
    case "maxCapacityPct":
      return row.maxCapacityPct;
    case "cycleCount":
      return row.cycleCount;
    case "ssdUsedPct":
      return row.ssdUsedPct;
    case "model":
      return `${row.device.modelName} ${row.shortId}`;
    default:
      return row.bench[key];
  }
}

/** 정렬. 값이 없는 기기(검사·진단 전)는 방향과 상관없이 맨 뒤, 같으면 기종 이름 순으로 늘 같은 순서 */
export function sortRows(rows: CatalogRow[], key: SortKey, dir: SortDir): CatalogRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valueOf(a, key);
    const vb = valueOf(b, key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const cmp = typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb), "ko") : va - vb;
      if (cmp !== 0) return cmp * sign;
    }
    return `${a.device.modelName}${a.shortId}`.localeCompare(`${b.device.modelName}${b.shortId}`, "ko");
  });
}

export interface CatalogFilter {
  q: string;
  availableOnly: boolean;
}

/** 검색: 기종 이름·코드·제조사·색상·CPU·그래픽·기기 번호 어디든 들어 있으면(대소문자·띄어쓰기 무시) */
export function filterRows(rows: CatalogRow[], { q, availableOnly }: CatalogFilter): CatalogRow[] {
  const needle = normalize(q);
  return rows.filter((r) => {
    if (availableOnly && !r.device.available) return false;
    if (!needle) return true;
    const d = r.device;
    const hay = normalize([d.modelName, d.modelCode, d.manufacturer, d.color, d.spec?.cpu, d.spec?.gpu, d.os, r.shortId, d.spec?.ramGb ? `${d.spec.ramGb}gb` : ""].join(" "));
    return hay.includes(needle);
  });
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, "");
}

/** 종류별 흠집을 "긁힘 2 · 찍힘 1"처럼. 0개 종류는 뺀다 */
export function classSummary(byClass: Record<DefectClass, number> | undefined, labels: Record<DefectClass, string>): string {
  if (!byClass) return "";
  return (Object.keys(labels) as DefectClass[])
    .filter((c) => (byClass[c] ?? 0) > 0)
    .map((c) => `${labels[c]} ${byClass[c]}`)
    .join(" · ");
}

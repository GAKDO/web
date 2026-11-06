import type { CaptureCamera, CaptureLight, Checkpoint, DefectClass, Inspection, InspectionGrade } from "../../../shared/api/types";
import { verdictOf } from "../../inspections/model/verdict";

/** 통계에 넣을 시점 하나: 렌탈 상세의 시점과 그 검사 결과(없으면 null) */
export interface CheckpointResult {
  checkpoint: Checkpoint;
  inspection: Inspection | null;
}

export interface DayCount {
  day: string;
  ok: number;
  bad: number;
}

export interface Bin {
  label: string;
  count: number;
}

export interface BenchmarkStats {
  /** 등급(A~D)이 매겨진 시점 수 */
  graded: number;
  ok: number;
  bad: number;
  /** 판정 대기·판정 불가처럼 등급이 없는 시점 */
  ungraded: number;
  byDay: DayCount[];
  grades: Record<InspectionGrade, number>;
  defectCount: number;
  meanConfidence: number | null;
  byClass: Bin[];
  /** 조명별 카메라별 흠집 수. 원본 사진 흠집(photoDefects, 부스 빠른 검사)에만 조명·카메라가 있다 */
  byLight: { light: CaptureLight; cams: Partial<Record<CaptureCamera, number>> }[];
  confidence: Bin[];
  modelVersions: Bin[];
}

const GRADES: InspectionGrade[] = ["A", "B", "C", "D"];
const LIGHTS: CaptureLight[] = ["L1", "L2", "L3", "L4", "ROOM", "OFF"];

/** 서울 시간 날짜(YYYY-MM-DD). 촬영이 끝난 시각(occurredAt)으로 묶는다 */
export function seoulDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 신뢰도 구간 0.0~0.1, …, 0.9~1.0 (1.0은 마지막 구간) */
export function confidenceBins(values: number[]): Bin[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}~${i * 10 + 10}%`, count: 0 }));
  for (const v of values) bins[Math.min(9, Math.max(0, Math.floor(v * 10)))].count += 1;
  return bins;
}

/**
 * 시점 검사 결과를 그래프용 숫자로 모은다. 등급은 서버가 준 값만 쓰고(화면이 판정하지 않음),
 * 흠집은 원본 사진 흠집(photoDefects)이 있으면 그것을, 없으면 표준 좌표 흠집(defects)을 센다.
 */
export function buildStats(results: CheckpointResult[]): BenchmarkStats {
  const grades: Record<InspectionGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
  const days = new Map<string, DayCount>();
  const classes = new Map<DefectClass, number>();
  const models = new Map<string, number>();
  const lights = new Map<CaptureLight, Partial<Record<CaptureCamera, number>>>();
  const confidences: number[] = [];
  let ok = 0;
  let bad = 0;
  let ungraded = 0;

  for (const { checkpoint, inspection } of results) {
    if (checkpoint.status === "OPEN") continue;
    const verdict = verdictOf(checkpoint, inspection);
    if (verdict.kind !== "ok" && verdict.kind !== "bad") {
      ungraded += 1;
      continue;
    }
    grades[verdict.grade] += 1;
    if (verdict.kind === "ok") ok += 1;
    else bad += 1;
    if (checkpoint.occurredAt) {
      const day = seoulDay(checkpoint.occurredAt);
      const row = days.get(day) ?? { day, ok: 0, bad: 0 };
      row[verdict.kind] += 1;
      days.set(day, row);
    }
    const photo = inspection?.photoDefects ?? [];
    const found = photo.length > 0 ? photo : (inspection?.defects ?? []);
    for (const d of found) {
      classes.set(d.class, (classes.get(d.class) ?? 0) + 1);
      models.set(d.modelVersion, (models.get(d.modelVersion) ?? 0) + 1);
      confidences.push(d.confidence);
    }
    for (const d of photo) {
      const cams = lights.get(d.light) ?? {};
      cams[d.camera] = (cams[d.camera] ?? 0) + 1;
      lights.set(d.light, cams);
    }
  }

  const sortDesc = (m: Map<string, number>) => [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return {
    graded: ok + bad,
    ok,
    bad,
    ungraded,
    byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    grades,
    defectCount: confidences.length,
    meanConfidence: confidences.length ? confidences.reduce((s, v) => s + v, 0) / confidences.length : null,
    byClass: sortDesc(classes),
    byLight: LIGHTS.filter((l) => lights.has(l)).map((light) => ({ light, cams: lights.get(light) ?? {} })),
    confidence: confidenceBins(confidences),
    modelVersions: sortDesc(models),
  };
}

export { GRADES };

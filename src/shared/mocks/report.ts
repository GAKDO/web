import { nanoid } from "nanoid";
import type {
  CaptureFace,
  CheckpointDiagnostics,
  CheckpointMedia,
  Device,
  Inspection,
  Rental,
  RentalTimeline,
  RunSummary,
  TimelineCheckpoint,
} from "../api/types";

// WE3 리포트 목 데이터. 값은 계약 C1 예시(report·capture·diagnostics)를 따른다.
// 고객 렌탈 ①: 출고·수령 봉인, 반납 검사 중(수령 때 신규 긁힘 1개, 배터리 91.2% → 84.0%). ②: 출고만 봉인.

export interface ReportState {
  /** 렌탈 → 고객 계정 */
  owners: Map<string, string>;
  timelines: Map<string, RentalTimeline>;
  inspections: Map<string, Inspection>;
  media: Map<string, CheckpointMedia>;
  diagnostics: Map<string, CheckpointDiagnostics>;
}

/** 면 사진 크기(px). 핀 좌표는 이 펼친 면 기준이다 */
export const TEXTURE_SIZE: Record<CaptureFace, { width: number; height: number }> = {
  TOP: { width: 600, height: 420 },
  BOT: { width: 600, height: 420 },
  KB: { width: 600, height: 420 },
  SCR0: { width: 600, height: 420 },
  SCR1: { width: 600, height: 420 },
  SF: { width: 600, height: 60 },
  SB: { width: 600, height: 60 },
  SL: { width: 420, height: 60 },
  SR: { width: 420, height: 60 },
};

const PHONE_FACES: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "SCR0"];
const BOOTH_FACES: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "KB", "SCR0"];

/** 면 이름이 적힌 SVG(외부 요청 없음) */
function svgUrl(label: string, width: number, height: number, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="${Math.min(height / 2, 40)}" text-anchor="middle" dominant-baseline="middle" fill="#334">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function media(checkpointId: string, faces: CaptureFace[], crops: string[], tint: string): CheckpointMedia {
  return {
    checkpointId,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    textures: faces.map((face) => ({ face, url: svgUrl(face, TEXTURE_SIZE[face].width, TEXTURE_SIZE[face].height, tint) })),
    crops: crops.map((defectId) => ({ defectId, url: svgUrl("흠집", 120, 120, "#f4d6c4") })),
  };
}

function run(collectedAt: string, maxCapacityPct: number, cycleCount: number): RunSummary {
  return {
    runId: nanoid(),
    collectedAt,
    os: "MACOS",
    battery: { cycleCount, designCapacity: 4382, fullChargeCapacity: Math.round((4382 * maxCapacityPct) / 100), capacityUnit: "mAh", maxCapacityPct, condition: "NORMAL" },
    ssd: { percentUsed: null, availableSparePct: null, criticalWarning: null, powerOnHours: null, mediaErrors: null, skippedReason: "smartctl 권한 없음" },
    components: [{ kind: "CPU", identifier: "Apple M2" }],
    benchmarks: [{ metric: "CPU_SINGLE", median: 2580 }],
  };
}

function checkpoint(type: TimelineCheckpoint["type"], status: TimelineCheckpoint["status"], at: string, extra: Partial<TimelineCheckpoint> = {}): TimelineCheckpoint {
  const sealed = status === "SEALED";
  return {
    checkpointId: nanoid(),
    type,
    status,
    occurredAt: at,
    grade: sealed ? "A" : null,
    newDefectCount: 0,
    pins: [],
    diagnosticsSummary: sealed ? { maxCapacityPct: 91.2, flags: [] } : null,
    sealedAt: sealed ? at : null,
    ...extra,
  };
}

export function customerFixtures(customerId: string, devices: [Device, Device]): { rentals: Rental[]; report: ReportState } {
  const state: ReportState = { owners: new Map(), timelines: new Map(), inspections: new Map(), media: new Map(), diagnostics: new Map() };
  const rentals: Rental[] = [];

  const add = (device: Device, checkpoints: TimelineCheckpoint[], status: Rental["status"]) => {
    const rentalId = nanoid();
    rentals.push({
      rentalId,
      deviceId: device.deviceId,
      renterRef: `R-20${rentals.length + 1}`,
      status,
      startedAt: checkpoints[0].occurredAt,
      endedAt: null,
      createdAt: "2026-11-12T08:50:00+09:00",
      checkpoints: checkpoints.map(({ checkpointId, type, status: s, occurredAt }) => ({ checkpointId, type, status: s, occurredAt })),
    });
    state.owners.set(rentalId, customerId);
    state.timelines.set(rentalId, {
      rentalId,
      modelCode: device.modelCode,
      chainStatus: "VALID",
      verifyUrl: "https://trace.example.com/verify/0123456789abcdef0123456789abcdef",
      checkpoints,
    });
    return rentalId;
  };

  // ① 출고(부스, 흠집 1개 기존) → 수령(폰, 신규 긁힘 1개) → 반납 검사 중
  const oldDefect = nanoid();
  const newDefect = nanoid();
  const out = checkpoint("OUT", "SEALED", "2026-11-12T09:00:00+09:00", { pins: [{ defectId: oldDefect, face: "BOT", x: 420, y: 300, isNew: false }] });
  const rcv = checkpoint("RCV", "SEALED", "2026-11-12T13:05:00+09:00", {
    grade: "B",
    newDefectCount: 1,
    pins: [
      { defectId: oldDefect, face: "BOT", x: 420, y: 300, isNew: false },
      { defectId: newDefect, face: "TOP", x: 150.2, y: 85, isNew: true },
    ],
    diagnosticsSummary: { maxCapacityPct: 84.0, flags: ["CAPACITY_DROP"] },
  });
  const ret = checkpoint("RET", "CAPTURED", "2026-11-19T10:00:00+09:00");
  add(devices[0], [out, rcv, ret], "RETURNED");

  const scratch = (defectId: string, face: CaptureFace, x: number, y: number, status: "NEW" | "EXISTING") => ({
    defectId,
    face,
    class: "scratch" as const,
    polygon: [[x - 30, y - 4], [x + 30, y - 2], [x + 30, y + 4], [x - 30, y + 2]],
    lengthMm: 12.0,
    areaMm2: 3.1,
    confidence: 0.91,
    modelVersion: "yolo11s-seg-v001",
    source: "AUTO" as const,
    match: { status, prevDefectId: null, distanceMm: null },
  });
  state.inspections.set(out.checkpointId, { checkpointId: out.checkpointId, grade: "A", ruleVersion: "grade-rules-v1", reasons: [], defects: [scratch(oldDefect, "BOT", 420, 300, "NEW")] });
  state.inspections.set(rcv.checkpointId, {
    checkpointId: rcv.checkpointId,
    grade: "B",
    ruleVersion: "grade-rules-v1",
    reasons: ["신규 긁힘 1개(12mm)"],
    defects: [scratch(oldDefect, "BOT", 420, 300, "EXISTING"), scratch(newDefect, "TOP", 150.2, 85, "NEW")],
  });
  state.media.set(out.checkpointId, media(out.checkpointId, BOOTH_FACES, [oldDefect], "#dfe7f2"));
  state.media.set(rcv.checkpointId, media(rcv.checkpointId, PHONE_FACES, [oldDefect, newDefect], "#e7efe1"));
  const outRun = run("2026-11-12T09:02:00+09:00", 91.2, 110);
  state.diagnostics.set(out.checkpointId, { checkpointId: out.checkpointId, current: outRun, previous: null, flags: [] });
  state.diagnostics.set(rcv.checkpointId, {
    checkpointId: rcv.checkpointId,
    current: run("2026-11-12T13:20:00+09:00", 84.0, 112),
    previous: outRun,
    flags: [{ kind: "CAPACITY_DROP", baseRunId: outRun.runId, detail: {} }],
  });

  // ② 출고만 봉인
  const out2 = checkpoint("OUT", "SEALED", "2026-11-14T09:00:00+09:00");
  add(devices[1], [out2], "OPEN");
  state.inspections.set(out2.checkpointId, { checkpointId: out2.checkpointId, grade: "A", ruleVersion: "grade-rules-v1", reasons: [], defects: [] });
  state.media.set(out2.checkpointId, media(out2.checkpointId, BOOTH_FACES, [], "#dfe7f2"));
  state.diagnostics.set(out2.checkpointId, { checkpointId: out2.checkpointId, current: run("2026-11-14T09:02:00+09:00", 95.0, 40), previous: null, flags: [] });

  return { rentals, report: state };
}

import { nanoid } from "nanoid";
import type {
  CaptureCamera,
  CaptureFace,
  CaptureLight,
  CheckpointDiagnostics,
  CheckpointMedia,
  CheckpointPhoto,
  Device,
  Inspection,
  PhotoDefect,
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

// 목 기종 치수(db.ts와 같음)와 contracts capture/faces.md의 배율 1 px = 0.25 mm로 면 사진 크기를 정한다
const MOCK_DIMS = { widthMm: 304, depthMm: 215, baseHMm: 11, lidHMm: 6 };
const PX_PER_MM = 4;
const flat = { width: MOCK_DIMS.widthMm * PX_PER_MM, height: MOCK_DIMS.depthMm * PX_PER_MM };
const sideH = (MOCK_DIMS.baseHMm + MOCK_DIMS.lidHMm) * PX_PER_MM;

/** 면 사진 크기(px). 핀 좌표는 이 표준 좌표 이미지 기준이다 */
export const TEXTURE_SIZE: Record<CaptureFace, { width: number; height: number }> = {
  TOP: flat,
  BOT: flat,
  KB: flat,
  SCR0: flat,
  SCR1: flat,
  SF: { width: flat.width, height: sideH },
  SB: { width: flat.width, height: sideH },
  SL: { width: flat.height, height: sideH },
  SR: { width: flat.height, height: sideH },
};

/** 면별 이미지 위쪽·왼쪽(faces.md). 목 사진에 적어 3D에서 방향을 눈으로 확인한다 */
const ORIENT: Record<CaptureFace, [string, string]> = {
  TOP: ["뒤", "왼"],
  BOT: ["뒤", "오른"],
  KB: ["뒤", "왼"],
  SCR0: ["화면 위", "왼"],
  SCR1: ["화면 위", "왼"],
  SF: ["위", "왼"],
  SB: ["위", "오른"],
  SL: ["위", "뒤"],
  SR: ["위", "앞"],
};

const PHONE_FACES: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "SCR0"];
const BOOTH_FACES: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "KB", "SCR0"];

/** 면 이름이 적힌 SVG(외부 요청 없음). 방향(위쪽·왼쪽)과 옆면의 본체·덮개 경계도 그린다 */
function svgUrl(label: string, width: number, height: number, fill: string, face?: CaptureFace): string {
  const size = Math.min(height / 2, 80);
  const small = Math.min(height / 3, 40);
  const [up, left] = face ? ORIENT[face] : ["", ""];
  const side = face === "SF" || face === "SB" || face === "SL" || face === "SR";
  const split = (MOCK_DIMS.lidHMm * PX_PER_MM).toString();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/>` +
    `<text x="50%" y="50%" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="#334">${label}</text>` +
    (face ? `<text x="50%" y="${small}" font-size="${small}" text-anchor="middle" fill="#a33">↑${up}</text><text x="4" y="${height / 2}" font-size="${small}" fill="#33a">←${left}</text>` : "") +
    (side ? `<line x1="0" x2="${width}" y1="${split}" y2="${split}" stroke="#555" stroke-width="2"/>` : "") +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function media(checkpointId: string, faces: CaptureFace[], crops: string[], tint: string): CheckpointMedia {
  return {
    checkpointId,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    textures: faces.map((face) => ({ face, url: svgUrl(face, TEXTURE_SIZE[face].width, TEXTURE_SIZE[face].height, tint, face) })),
    crops: crops.map((defectId) => ({ defectId, url: svgUrl("흠집", 120, 120, "#f4d6c4") })),
  };
}

function run(collectedAt: string, maxCapacityPct: number, cycleCount: number, speed = 1): RunSummary {
  return {
    runId: nanoid(),
    collectedAt,
    os: "MACOS",
    battery: { cycleCount, designCapacity: 4382, fullChargeCapacity: Math.round((4382 * maxCapacityPct) / 100), capacityUnit: "mAh", maxCapacityPct, condition: "NORMAL", skippedReason: null },
    ssd: { percentUsed: null, availableSparePct: null, criticalWarning: null, powerOnHours: null, mediaErrors: null, skippedReason: "NO_PERMISSION" },
    components: [{ kind: "CPU", identifier: "Apple M2" }],
    benchmarks: [
      { metric: "CPU_SINGLE", median: Math.round(2580 * speed) },
      { metric: "CPU_MULTI", median: Math.round(9720 * speed) },
      { metric: "MEM_COPY", median: Math.round(61200 * speed) },
      { metric: "DISK_READ", median: Math.round(2950 * speed) },
      { metric: "DISK_WRITE", median: Math.round(2410 * (speed < 1 ? 0.86 : 1)) },
    ],
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

  // match: 출고는 짝이 없어 null, 기존 흠집은 직전 시점 흠집을 가리킨다(실서버는 시점마다 defectId가 따로 생긴다)
  const scratch = (defectId: string, face: CaptureFace, x: number, y: number, match: { status: "NEW" | "EXISTING"; prevDefectId: string | null; distanceMm: number | null } | null) => ({
    defectId,
    face,
    class: "scratch" as const,
    polygon: [[x - 30, y - 4], [x + 30, y - 2], [x + 30, y + 4], [x - 30, y + 2]],
    lengthMm: 12.0,
    areaMm2: 3.1,
    confidence: 0.91,
    modelVersion: "yolo11s-seg-v001",
    source: "AUTO" as const,
    match,
  });
  state.inspections.set(out.checkpointId, { checkpointId: out.checkpointId, grade: "A", ruleVersion: "grade-rules-v1", reasons: [], defects: [scratch(oldDefect, "BOT", 420, 300, null)] });
  state.inspections.set(rcv.checkpointId, {
    checkpointId: rcv.checkpointId,
    grade: "B",
    ruleVersion: "grade-rules-v1",
    reasons: ["신규 긁힘 1개(12mm)"],
    defects: [
      scratch(oldDefect, "BOT", 420, 300, { status: "EXISTING", prevDefectId: oldDefect, distanceMm: 0.8 }),
      scratch(newDefect, "TOP", 150.2, 85, { status: "NEW", prevDefectId: null, distanceMm: null }),
    ],
  });
  state.media.set(out.checkpointId, media(out.checkpointId, BOOTH_FACES, [oldDefect], "#dfe7f2"));
  state.media.set(rcv.checkpointId, media(rcv.checkpointId, PHONE_FACES, [oldDefect, newDefect], "#e7efe1"));
  const outRun = run("2026-11-12T09:02:00+09:00", 91.2, 110);
  state.diagnostics.set(out.checkpointId, { checkpointId: out.checkpointId, current: outRun, previous: null, flags: [] });
  state.diagnostics.set(rcv.checkpointId, {
    checkpointId: rcv.checkpointId,
    current: run("2026-11-12T13:20:00+09:00", 84.0, 112, 0.97),
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

// MVP(11/3) 부스 빠른 검사(QUICK) 세트: 위·아래 2면 × 조명 L1·L2·L3 × CAM1·CAM2 = 원본 사진 12장(1600×1200), 흠집은 원본 px(contracts 1.1.0)
const QUICK_FACES: CaptureFace[] = ["TOP", "BOT"];
const QUICK_LIGHTS: CaptureLight[] = ["L1", "L2", "L3"];
const QUICK_CAMERAS: CaptureCamera[] = ["CAM1", "CAM2"];
const LIGHT_TINT: Record<CaptureLight, string> = { L1: "#e3e8ef", L2: "#d9e2ea", L3: "#cfd9e3", L4: "#c9d3dd", ROOM: "#efe9df", OFF: "#555" };
export const QUICK_PHOTO = { width: 1600, height: 1200 };

/** QUICK 세트의 원본 사진 12장(면 이름이 적힌 SVG) */
export function quickPhotos(): CheckpointPhoto[] {
  return QUICK_FACES.flatMap((face) =>
    QUICK_CAMERAS.flatMap((camera) =>
      QUICK_LIGHTS.map((light) => ({ face, light, camera, url: svgUrl(`${face} ${light} ${camera}`, QUICK_PHOTO.width, QUICK_PHOTO.height, LIGHT_TINT[light]) })),
    ),
  );
}

/** 원본 사진 px 흠집 하나(가로로 긴 사각형 폴리곤) */
export function quickDefect(face: CaptureFace, light: CaptureLight, camera: CaptureCamera, cls: PhotoDefect["class"], cx: number, cy: number, confidence: number): PhotoDefect {
  return {
    defectId: nanoid(),
    face,
    light,
    camera,
    class: cls,
    polygon: [[cx - 60, cy - 8], [cx + 60, cy - 4], [cx + 60, cy + 8], [cx - 60, cy + 4]],
    confidence,
    modelVersion: "yolo11s-seg-v002",
  };
}

/** QUICK 세트 사진 응답(정합 텍스처·크롭 없음) */
export function quickMedia(checkpointId: string): CheckpointMedia {
  return { checkpointId, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), textures: [], crops: [], photos: quickPhotos() };
}

/**
 * 관리자가 만든 렌탈의 출고 시점이 QUICK 세트로 등급 C: 윗면 긁힘(조명 L1·L2 두 사진에 같은 자리), 바닥 찍힘.
 * MVP는 렌탈당 출고 검사 1번이라 출고 검사 뒤 반납됨(RETURNED)으로 둔다
 */
export function quickFixture(device: Device): { rental: Rental; inspection: Inspection; media: CheckpointMedia } {
  const checkpointId = nanoid();
  const at = "2026-11-05T10:00:00+09:00";
  return {
    rental: {
      rentalId: nanoid(),
      deviceId: device.deviceId,
      renterRef: "R-1002",
      status: "RETURNED",
      startedAt: at,
      endedAt: null,
      createdAt: at,
      checkpoints: [{ checkpointId, type: "OUT", status: "GRADED", occurredAt: at }],
    },
    inspection: {
      checkpointId,
      grade: "C",
      ruleVersion: "grade-rules-v1",
      reasons: ["긁힘 1개·찍힘 1개 (부스 빠른 검사, 앞 시점과 비교 없음)"],
      defects: [],
      photoDefects: [
        quickDefect("TOP", "L1", "CAM1", "scratch", 600, 400, 0.91),
        quickDefect("TOP", "L2", "CAM1", "scratch", 604, 402, 0.87),
        quickDefect("BOT", "L3", "CAM2", "dent", 900, 700, 0.78),
      ],
    },
    media: quickMedia(checkpointId),
  };
}

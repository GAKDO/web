import { http, HttpResponse } from "msw";
import type { CaptureBenchmark, CaptureBenchmarkList } from "../../api/types";
import { db } from "../db";
import { problem } from "./problem";
import { rentalDenied, rentalOfCheckpoint } from "./report";

// WE3 리포트가 로그인 JWT로 읽는 capture-server 검사 결과·사진 보기 주소 목(WE2의 촬영 목과 따로 둔다)
/** 성능 그래프 목: 부스 세트 3개(하나는 30초 넘음), 폰 세트 1개. 모델 점수는 아직 없음(서버 기본과 같음) */
function benchmarkFixture(): CaptureBenchmarkList {
  const set = (i: number, source: "BOOTH" | "PHONE", boothTotalMs: number | null, inferenceMs: number | null, completedToGradedMs: number | null): CaptureBenchmark => ({
    captureSetId: `bench-set-${i}`.padEnd(21, "x"),
    checkpointId: `bench-cp-${i}`.padEnd(21, "x"),
    source,
    profile: source === "BOOTH" ? "QUICK" : "FULL",
    boothId: source === "BOOTH" ? "booth-01" : null,
    modelVersion: "yolo11s-seg-v001-trt-fp16",
    photoCount: source === "BOOTH" ? 12 : 9,
    inferenceMs,
    createdAt: `2026-11-06T0${i}:00:00+09:00`,
    completedAt: `2026-11-06T0${i}:00:40+09:00`,
    detectionsReceivedAt: `2026-11-06T0${i}:01:00+09:00`,
    gradedAt: `2026-11-06T0${i}:01:02+09:00`,
    completedToGradedMs,
    boothTotalMs,
  });
  return {
    items: [set(4, "PHONE", null, null, 95000), set(3, "BOOTH", 34100, 12800, 6100), set(2, "BOOTH", 26500, 11900, 5200), set(1, "BOOTH", 24800, 12100, 4800)],
    models: [],
  };
}

export const captureReportHandlers = [
  http.get("*/api/v1/captures/benchmarks", ({ request }) => {
    const source = new URL(request.url).searchParams.get("source");
    const list = benchmarkFixture();
    return HttpResponse.json({ ...list, items: source ? list.items.filter((i) => i.source === source) : list.items });
  }),

  http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const inspection = db.report.inspections.get(checkpointId);
    return inspection ? HttpResponse.json(inspection) : problem(404, "NOT_FOUND", "검사 결과가 없습니다");
  }),

  http.get("*/api/v1/captures/checkpoints/:checkpointId/media", ({ request, params }) => {
    const checkpointId = String(params.checkpointId);
    const no = rentalDenied(request, rentalOfCheckpoint(checkpointId));
    if (no) return no;
    const media = db.report.media.get(checkpointId);
    if (!media) return problem(404, "NOT_FOUND", "사진이 없습니다");
    // 부를 때마다 10분짜리 새 주소(계약)
    return HttpResponse.json({ ...media, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  }),
];

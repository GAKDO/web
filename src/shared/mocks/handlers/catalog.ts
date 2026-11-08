import { http, HttpResponse } from "msw";
import type { CatalogDevice, CatalogDiagnostics, CatalogInspection, CatalogInspectionSummary, CatalogPhotoDefect, DefectClass, PhotoDefect } from "../../api/types";
import { db } from "../db";
import { problem } from "./problem";

// 공개 보유 기기 목록·상세 목(11/8, contracts #33). 다른 목(db.devices·rentals·report)에서 그대로 만든다.

const SEVERITY: Record<DefectClass, number> = { stain: 0, scratch: 1, dent: 2, crack: 3 };

/** 서버의 묶기(같은 면·카메라에서 5 mm 안)를 흉내 낸다: groupId가 있으면 그대로, 없으면 면·카메라·가까운 위치로 */
function grouped(defects: PhotoDefect[]): CatalogPhotoDefect[] {
  const heads: { key: string; x: number; y: number; id: string }[] = [];
  return defects.map((d) => {
    const [x, y] = d.polygon[0] ?? [0, 0];
    const key = `${d.face}:${d.camera}`;
    let head = d.groupId ? { id: d.groupId } : heads.find((h) => h.key === key && Math.hypot(h.x - x, h.y - y) < 40);
    if (!head) {
      head = { key, x, y, id: d.defectId };
      heads.push(head as { key: string; x: number; y: number; id: string });
    }
    return { defectId: d.defectId, face: d.face, light: d.light, camera: d.camera, class: d.class, polygon: d.polygon, groupId: head.id };
  });
}

function summaryOf(checkpointId: string): (CatalogInspectionSummary & { defects: CatalogPhotoDefect[] }) | null {
  const ins = db.report.inspections.get(checkpointId);
  if (!ins?.grade) return null;
  const defects = grouped((ins.photoDefects ?? []).filter((d) => d.review?.status !== "DISMISSED" && d.review?.status !== "PENDING"));
  const worst = new Map<string, DefectClass>();
  for (const d of defects) {
    const w = worst.get(d.groupId);
    if (!w || SEVERITY[d.class] > SEVERITY[w]) worst.set(d.groupId, d.class);
  }
  const defectsByClass = { scratch: 0, dent: 0, crack: 0, stain: 0 };
  worst.forEach((c) => (defectsByClass[c] += 1));
  return { checkpointId, grade: ins.grade, gradedAt: "2026-11-05T10:05:00+09:00", defectCount: worst.size, defectsByClass, defects };
}

const idsOf = (request: Request) =>
  (new URL(request.url).searchParams.get("checkpointIds") ?? "")
    .split(",")
    .filter(Boolean);

export const catalogHandlers = [
  http.get("*/api/v1/catalog/devices", () => {
    const items: CatalogDevice[] = db.devices
      .filter((d) => d.status !== "RETIRED")
      .map((d) => {
        const m = db.models.find((x) => x.modelCode === d.modelCode)!;
        const rentals = db.rentals.filter((r) => r.deviceId === d.deviceId);
        const checkpoints = rentals
          .flatMap((r) => r.checkpoints)
          .filter((c) => c.status === "GRADED" || c.status === "SEALED")
          .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""))
          .map((c) => ({ checkpointId: c.checkpointId, type: c.type, status: c.status, occurredAt: c.occurredAt }));
        return {
          deviceId: d.deviceId,
          modelCode: d.modelCode,
          modelName: d.modelName,
          manufacturer: m.manufacturer,
          os: d.os,
          color: d.color,
          status: d.status,
          available: d.status === "ACTIVE" && !rentals.some((r) => r.status === "OPEN"),
          rentalCount: rentals.length,
          spec: m.spec,
          dimensions: m.dimensions,
          checkpoints,
        };
      });
    return HttpResponse.json({ items });
  }),
  http.get("*/api/v1/captures/catalog", ({ request }) => {
    const items = idsOf(request).flatMap((id) => {
      const s = summaryOf(id);
      if (!s) return [];
      const { defects: _defects, ...summary } = s;
      void _defects;
      return [summary];
    });
    return HttpResponse.json({ items });
  }),
  http.get("*/api/v1/captures/catalog/checkpoints/:checkpointId", ({ params }) => {
    const id = String(params.checkpointId);
    const s = summaryOf(id);
    const media = db.report.media.get(id);
    if (!s || !media) return problem(404, "NOT_FOUND", "공개 검사 결과가 없습니다");
    const { defects, ...summary } = s;
    const body: CatalogInspection = { ...summary, expiresAt: media.expiresAt, photos: media.photos ?? [], photoDefects: defects };
    return HttpResponse.json(body);
  }),
  http.get("*/api/v1/diagnostics/catalog", ({ request }) => {
    const items: CatalogDiagnostics[] = idsOf(request).flatMap((id) => {
      const d = db.report.diagnostics.get(id);
      if (!d) return [];
      const { current } = d;
      return [{ checkpointId: id, collectedAt: current.collectedAt, os: current.os, battery: current.battery, ssd: current.ssd, benchmarks: current.benchmarks }];
    });
    return HttpResponse.json({ items });
  }),
];

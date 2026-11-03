import type { Defect, Inspection } from "../../../shared/api/types";
import { quickDefect, quickPhotos } from "../../../shared/mocks/report";
import { faceGrids, photoDefectsOf, polygonPoints, textureOverlays } from "./photos";

test("원본 사진 격자는 면마다 카메라 행 × 조명 열이고 사진·흠집을 제자리에 넣는다", () => {
  const defects = [quickDefect("TOP", "L1", "CAM1", "scratch", 600, 400, 0.9), quickDefect("BOT", "L3", "CAM2", "dent", 900, 700, 0.8)];
  const grids = faceGrids(quickPhotos(), defects);
  expect(grids.map((g) => g.face)).toEqual(["TOP", "BOT"]);
  expect(grids[0].cameras).toEqual(["CAM1", "CAM2"]);
  expect(grids[0].lights).toEqual(["L1", "L2", "L3"]);
  expect(grids[0].cells.map((c) => `${c.camera}:${c.light}`)).toEqual(["CAM1:L1", "CAM1:L2", "CAM1:L3", "CAM2:L1", "CAM2:L2", "CAM2:L3"]);
  expect(grids[0].cells.every((c) => c.photo?.face === "TOP")).toBe(true);
  expect(grids[0].cells[0].defects).toEqual([defects[0]]);
  expect(grids[0].cells[1].defects).toEqual([]);
  expect(grids.map((g) => g.defectCount)).toEqual([1, 1]);
});

test("사진이 아직 없어도 흠집이 있는 면·카메라·조명 칸은 사진 없음(null)으로 만든다", () => {
  const grids = faceGrids([], [quickDefect("BOT", "L2", "CAM2", "dent", 1, 1, 0.5)]);
  expect(grids).toHaveLength(1);
  expect(grids[0].cells).toEqual([expect.objectContaining({ face: "BOT", camera: "CAM2", light: "L2", photo: null })]);
});

test("면 사진 겹치기는 사진이 있는 면만 codes.yaml 순으로 두고 그 면의 흠집을 붙인다", () => {
  const defect: Defect = { defectId: "d1", face: "BOT", class: "scratch", polygon: [[0, 0], [1, 0], [1, 1]], lengthMm: null, areaMm2: null, confidence: 0.5, modelVersion: "m", source: "AUTO", match: null };
  const overlays = textureOverlays({ textures: [{ face: "BOT", url: "b" }, { face: "TOP", url: "t" }] }, [defect]);
  expect(overlays.map((o) => [o.face, o.url, o.defects.length])).toEqual([["TOP", "t", 0], ["BOT", "b", 1]]);
});

test("photoDefects가 없는(계약 1.0.0) 결과는 빈 배열이고, polygon points는 x,y 쌍을 공백으로 잇는다", () => {
  const legacy: Inspection = { checkpointId: "c", grade: "A", ruleVersion: null, reasons: [], defects: [] };
  expect(photoDefectsOf(null)).toEqual([]);
  expect(photoDefectsOf(legacy)).toEqual([]);
  expect(polygonPoints([[1, 2], [3.5, 4]])).toBe("1,2 3.5,4");
});

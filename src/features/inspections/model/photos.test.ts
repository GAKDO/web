import type { Defect, Inspection } from "../../../shared/api/types";
import { quickDefect, quickPhotos } from "../../../shared/mocks/report";
import { countedDefects, failedFaces, faceGrids, isQuickInspection, photoDefectsOf, photoOnlyDefects, polygonPoints, textureOverlays, unjudgeableOf } from "./photos";

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
  const defect: Defect = {
    defectId: "d1",
    face: "BOT",
    class: "scratch",
    polygon: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    lengthMm: null,
    areaMm2: null,
    confidence: 0.5,
    modelVersion: "m",
    source: "AUTO",
    match: null,
  };
  const overlays = textureOverlays(
    {
      textures: [
        { face: "BOT", url: "b" },
        { face: "TOP", url: "t" },
      ],
    },
    [defect],
  );
  expect(overlays.map((o) => [o.face, o.url, o.defects.length])).toEqual([
    ["TOP", "t", 0],
    ["BOT", "b", 1],
  ]);
});

test("photoDefects가 없는(계약 1.0.0) 결과는 빈 배열이고, polygon points는 x,y 쌍을 공백으로 잇는다", () => {
  const legacy: Inspection = { checkpointId: "c", grade: "A", ruleVersion: null, reasons: [], defects: [] };
  expect(photoDefectsOf(null)).toEqual([]);
  expect(photoDefectsOf(legacy)).toEqual([]);
  expect(
    polygonPoints([
      [1, 2],
      [3.5, 4],
    ]),
  ).toBe("1,2 3.5,4");
});

describe("전체 검사 판정 근거(11/9)", () => {
  const graded: Defect = {
    defectId: "kb1",
    face: "KB",
    class: "dent",
    polygon: [
      [0, 0],
      [4, 0],
      [4, 4],
    ],
    lengthMm: 11.5,
    areaMm2: 62,
    confidence: 0.43,
    modelVersion: "v004",
    source: "AUTO",
    match: null,
  };
  const kbPhoto = { ...quickDefect("KB", "L1", "CAM1", "dent", 100, 100, 0.43), defectId: "kb1" };
  const sidePhoto = { ...quickDefect("SF", "L1", "CAM1", "scratch", 300, 40, 0.7), defectId: "sf1" };
  const full: Inspection = {
    checkpointId: "cp",
    grade: "A",
    ruleVersion: "grade-rules-v1",
    reasons: ["흠집 없음 → A"],
    defects: [graded],
    photoDefects: [kbPhoto, sidePhoto],
    profile: "FULL",
    unjudgeableFaces: [
      { face: "SF", reason: "정합 실패 또는 품질 미달(CAM1) - 면이 사진 밖으로 나감(두 변 이상 잘림)" },
      { face: "SCR1", reason: "건너뜀(스킵)" },
    ],
  };

  test("photoDefects가 있어도 profile이 FULL이면 빠른 검사로 보지 않고 흠집은 defects로 센다", () => {
    expect(isQuickInspection(full)).toBe(false);
    expect(countedDefects(full)).toEqual([graded]);
  });

  test("profile이 없는 예전 서버는 photoDefects가 있으면 빠른 검사로 본다", () => {
    expect(isQuickInspection({ ...full, profile: undefined, defects: [] })).toBe(true);
  });

  test("정합 실패 면에서 AI가 본 흠집은 등급 미반영 흠집으로 따로 나온다", () => {
    expect(photoOnlyDefects(full).map((d) => d.defectId)).toEqual(["sf1"]);
  });

  test("건너뛴 선택 면은 경고하지 않고 정합 실패 면만 경고한다", () => {
    expect(unjudgeableOf(full).map((u) => [u.face, u.skipped])).toEqual([
      ["SF", false],
      ["SCR1", true],
    ]);
    expect(failedFaces(full).map((u) => u.face)).toEqual(["SF"]);
  });

  test("unjudgeableFaces가 없는 예전 서버는 등급 근거 문장에서 판정 불가 면을 읽는다", () => {
    const old: Inspection = { ...full, unjudgeableFaces: undefined, reasons: ["흠집 없음 → A", "판정 불가 면 SL: 정합 실패 또는 품질 미달(CAM1)", "판정 불가 면 SCR1: 건너뜀(스킵)"] };
    expect(failedFaces(old)).toEqual([{ face: "SL", reason: "정합 실패 또는 품질 미달(CAM1)", skipped: false }]);
  });
});

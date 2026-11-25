// 이 파일이 확인하는 것: 관리자 검사 결과 화면에서 원본 사진과 흠집 표시를 정리하는 계산들.
// 부스 사진은 면마다 카메라 2대(CAM1·CAM2) × 조명 3개(L1·L2·L3)로 찍는다. 빠른 검사(QUICK)와 전체 검사(FULL)의 차이,
// 판정할 수 없던 면(정합 실패 등)을 다루는 규칙도 본다.

import type { Defect, Inspection } from "../../../shared/api/types";
import { quickDefect, quickPhotos } from "../../../shared/mocks/report";
import { countedDefects, failedFaces, faceGrids, isQuickInspection, photoDefectsOf, photoOnlyDefects, polygonPoints, textureOverlays, unjudgeableOf } from "./photos";

// [상황] 윗면·바닥 사진과, 윗면(CAM1·L1)과 바닥(CAM2·L3)에 흠집이 하나씩 있다.
// [기대] 면마다 카메라 행 × 조명 열의 6칸 격자가 만들어지고, 사진과 흠집이 맞는 칸에 들어가며, 면마다 흠집 수는 1이다.
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

// [상황] 바닥에 흠집 표시가 2개 있는데, 관리자가 하나를 "흠집 아님"으로 정했다.
// [기대] 면 흠집 수는 1(흠집 아님 제외), 사진 위 표시 수는 2(그대로 표시)다.
test("면 흠집 수(groupCount)는 흠집 아님으로 정한 표시를 빼고, 사진 속 표시 수(defectCount)는 그대로 센다", () => {
  const kept = quickDefect("BOT", "L1", "CAM1", "scratch", 600, 400, 0.9);
  const dismissed = { ...quickDefect("BOT", "L2", "CAM2", "dent", 900, 700, 0.4), review: { status: "DISMISSED" as const, reason: null, reviewedBy: "admin0000000000000001", reviewedAt: new Date().toISOString() } };
  const bot = faceGrids(quickPhotos(), [kept, dismissed]).find((g) => g.face === "BOT")!;
  expect(bot.groupCount).toBe(1);
  expect(bot.defectCount).toBe(2);
});

// [상황] 사진은 아직 없고 바닥(CAM2·L2)에 흠집만 있다.
// [기대] 그 칸을 "사진 없음"으로 만들어 흠집이 사라지지 않게 한다.
test("사진이 아직 없어도 흠집이 있는 면·카메라·조명 칸은 사진 없음(null)으로 만든다", () => {
  const grids = faceGrids([], [quickDefect("BOT", "L2", "CAM2", "dent", 1, 1, 0.5)]);
  expect(grids).toHaveLength(1);
  expect(grids[0].cells).toEqual([expect.objectContaining({ face: "BOT", camera: "CAM2", light: "L2", photo: null })]);
});

// [상황] 바닥·윗면 순서로 사진이 오고, 바닥에 흠집이 하나 있다.
// [기대] 면 순서를 계약(codes.yaml) 순서(윗면 → 바닥)로 맞추고, 바닥에만 흠집 1개를 붙인다.
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

// [상황] 사진별 흠집 칸이 없던 예전 계약(1.0.0)의 결과와 빈 결과, 흠집 테두리 좌표가 있다.
// [기대] 사진별 흠집은 빈 목록이다. 좌표는 "x,y x,y" 모양 글자로 이어 사진 위에 테두리를 그릴 수 있게 한다.
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

// 테스트 묶음: 전체 검사(FULL) 결과 하나를 두고 판정 근거를 나누는 규칙. 키보드 찍힘 1개는 등급에 반영됐고,
// 옆면(SF)은 정합 실패로 판정 불가, 흰 화면(SCR1)은 건너뛴 결과다.
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

  // [상황] 사진별 흠집이 있는 전체 검사 결과다.
  // [기대] 빠른 검사로 보지 않고, 흠집 수는 등급에 반영된 흠집(키보드 찍힘 1개)으로 센다.
  test("photoDefects가 있어도 profile이 FULL이면 빠른 검사로 보지 않고 흠집은 defects로 센다", () => {
    expect(isQuickInspection(full)).toBe(false);
    expect(countedDefects(full)).toEqual([graded]);
  });

  // [상황] 검사 종류(profile) 칸이 없는 예전 서버 결과에 사진별 흠집만 있다.
  // [기대] 빠른 검사로 본다.
  test("profile이 없는 예전 서버는 photoDefects가 있으면 빠른 검사로 본다", () => {
    expect(isQuickInspection({ ...full, profile: undefined, defects: [] })).toBe(true);
  });

  // [상황] 정합 실패한 옆면에서 AI가 흠집을 봤다.
  // [기대] 그 흠집은 "등급 미반영 흠집"으로 따로 나온다(관리자가 직접 확인하도록).
  test("정합 실패 면에서 AI가 본 흠집은 등급 미반영 흠집으로 따로 나온다", () => {
    expect(photoOnlyDefects(full).map((d) => d.defectId)).toEqual(["sf1"]);
  });

  // [상황] 옆면은 정합 실패, 흰 화면은 건너뜀으로 판정 불가다.
  // [기대] 둘 다 판정 불가 목록에 있지만, 경고는 정합 실패한 옆면만 한다(선택 면을 건너뛴 건 문제가 아님).
  test("건너뛴 선택 면은 경고하지 않고 정합 실패 면만 경고한다", () => {
    expect(unjudgeableOf(full).map((u) => [u.face, u.skipped])).toEqual([
      ["SF", false],
      ["SCR1", true],
    ]);
    expect(failedFaces(full).map((u) => u.face)).toEqual(["SF"]);
  });

  // [상황] 판정 불가 면 칸이 없는 예전 서버 결과로, 등급 근거 문장에 "판정 불가 면 SL: …"이 적혀 있다.
  // [기대] 문장에서 판정 불가 면을 읽어, 정합 실패한 왼쪽 옆면(SL)만 경고 대상으로 뽑는다.
  test("unjudgeableFaces가 없는 예전 서버는 등급 근거 문장에서 판정 불가 면을 읽는다", () => {
    const old: Inspection = { ...full, unjudgeableFaces: undefined, reasons: ["흠집 없음 → A", "판정 불가 면 SL: 정합 실패 또는 품질 미달(CAM1)", "판정 불가 면 SCR1: 건너뜀(스킵)"] };
    expect(failedFaces(old)).toEqual([{ face: "SL", reason: "정합 실패 또는 품질 미달(CAM1)", skipped: false }]);
  });
});

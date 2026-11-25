// 이 파일이 확인하는 것: 폰 촬영 화면의 면별 윤곽 안내(어느 면을 어떤 방향으로 찍는지). 기준은 contracts faces.md다.

import { DEFAULT_DIMENSIONS, PHONE_FACES, faceGuides } from "./faces";

// 테스트 도구: 기종 치수로 면별 안내를 만들어 면 이름으로 찾게 한다.
const byFace = (dims = DEFAULT_DIMENSIONS) => Object.fromEntries(faceGuides(dims).map((g) => [g.face, g]));

// [상황] 가로 300 × 깊이 200 × 본체 6 + 덮개 4mm 기종으로 면별 윤곽 비율을 계산한다.
// [기대] 윗면·바닥·화면은 1.5(300:200), 앞·뒤 옆면은 30(300:10), 좌·우 옆면은 20(200:10)이다.
test("윤곽 비율은 contracts faces.md의 면별 크기(가로 × 세로)를 기종 치수로 계산한다", () => {
  const d = { widthMm: 300, depthMm: 200, baseHMm: 6, lidHMm: 4 };
  const g = byFace(d);
  expect(g.TOP.aspect).toBe(1.5);
  expect(g.BOT.aspect).toBe(1.5);
  expect(g.SCR0.aspect).toBe(1.5);
  expect(g.SF.aspect).toBe(30);
  expect(g.SB.aspect).toBe(30);
  expect(g.SL.aspect).toBe(20);
  expect(g.SR.aspect).toBe(20);
});

// [상황] 면마다 사진의 위쪽·왼쪽이 기기의 어디인지 안내한다.
// [기대] faces.md 표와 같다(예: 윗면은 위쪽이 경첩, 왼쪽이 내 왼쪽).
test("면별 위쪽·왼쪽 방향이 faces.md 표와 같다", () => {
  const g = byFace();
  expect([g.TOP.top, g.TOP.left]).toEqual(["경첩", "내 왼쪽"]);
  expect([g.BOT.top, g.BOT.left]).toEqual(["경첩", "내 오른쪽"]);
  expect([g.SF.top, g.SF.left]).toEqual(["덮개", "내 왼쪽"]);
  expect([g.SB.top, g.SB.left]).toEqual(["덮개", "내 오른쪽"]);
  expect([g.SL.top, g.SL.left]).toEqual(["덮개", "경첩"]);
  expect([g.SR.top, g.SR.left]).toEqual(["덮개", "여는 쪽"]);
  expect([g.SCR0.top, g.SCR0.left]).toEqual(["화면 위 모서리", "내 왼쪽"]);
});

// [상황] 바닥(BOT) 촬영 안내를 본다.
// [기대] "앞 모서리를 들어 뒤로 넘겨" 한 방향만 알려 준다(뒤집는 방향이 달라 사진 방향이 섞이지 않게).
test("BOT 안내는 앞 모서리를 들어 뒤로 넘기는 한 방향만 알려 준다", () => {
  expect(byFace().BOT.guide).toContain("앞 모서리를 들어 뒤로 넘겨");
});

// [상황] 폰 촬영 면 목록에서 선택 면을 찾는다.
// [기대] 흰 화면(SCR1)만 선택이다.
test("SCR1만 선택 면이다", () => {
  expect(PHONE_FACES.filter((f) => !f.required).map((f) => f.face)).toEqual(["SCR1"]);
});

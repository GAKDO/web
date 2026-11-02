import { DEFAULT_DIMENSIONS, PHONE_FACES, faceGuides } from "./faces";

const byFace = (dims = DEFAULT_DIMENSIONS) => Object.fromEntries(faceGuides(dims).map((g) => [g.face, g]));

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

test("면별 위쪽·왼쪽 방향이 faces.md 표와 같다", () => {
  const g = byFace();
  expect([g.TOP.top, g.TOP.left]).toEqual(["경첩", "내 왼쪽"]);
  expect([g.BOT.top, g.BOT.left]).toEqual(["경첩", "내 오른쪽"]);
  expect([g.SF.top, g.SF.left]).toEqual(["상판", "내 왼쪽"]);
  expect([g.SB.top, g.SB.left]).toEqual(["상판", "내 오른쪽"]);
  expect([g.SL.top, g.SL.left]).toEqual(["상판", "경첩"]);
  expect([g.SR.top, g.SR.left]).toEqual(["상판", "앞"]);
  expect([g.SCR0.top, g.SCR0.left]).toEqual(["화면 위 모서리", "내 왼쪽"]);
});

test("BOT 안내는 앞 모서리를 들어 뒤로 넘기는 한 방향만 알려 준다", () => {
  expect(byFace().BOT.guide).toContain("앞 모서리를 들어 뒤로 넘겨");
});

test("SCR1만 선택 면이다", () => {
  expect(PHONE_FACES.filter((f) => !f.required).map((f) => f.face)).toEqual(["SCR1"]);
});

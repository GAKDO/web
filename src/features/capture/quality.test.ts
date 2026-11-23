// 이 파일이 확인하는 것: 폰 촬영 사진 품질 검사. 찍은 사진이 흔들림·반사·어두움으로 흠집을 판정하기 어려우면 다시 찍게 한다.
// 시험 사진은 testing.ts의 가짜 회색 그림(선명·흐림·반사·어두움)이다.

import { readFileSync } from "node:fs";
import { PHONE_FACES, PHONE_REQUIRED_FACES } from "./faces";
import { checkQuality, liveHint, toGray } from "./quality";
import { blurredGray, darkGray, glareGray, sharpGray } from "./testing";

// [상황] 계약 파일 codes.yaml의 폰 필수 면 목록과 촬영 화면의 면 목록을 비교한다.
// [기대] 둘이 같고, 폰은 키보드(KB)를 찍지 않으며, 흰 화면(SCR1)은 선택이다.
test("폰 필수 면은 contracts codes.yaml capture.face_required.PHONE과 같고 키보드는 찍지 않는다", () => {
  const yaml = readFileSync("contracts/codes.yaml", "utf8");
  const line = /^\s+PHONE:\s*\[([^\]]+)\]/m.exec(yaml);
  expect(line?.[1].split(",").map((s) => s.trim())).toEqual([...PHONE_REQUIRED_FACES]);
  expect(PHONE_FACES.filter((f) => f.required).map((f) => f.face)).toEqual([...PHONE_REQUIRED_FACES]);
  expect(PHONE_FACES.map((f) => f.face)).not.toContain("KB");
  expect(PHONE_FACES.find((f) => f.face === "SCR1")?.required).toBe(false);
});

// [상황] 선명한 사진 10장을 검사한다.
// [기대] 9장 이상 통과한다(멀쩡한 사진을 다시 찍게 하는 일이 드묾).
test("선명한 시험 사진 10장 중 9장 이상이 통과한다", () => {
  const passed = Array.from({ length: 10 }, (_, i) => checkQuality(sharpGray(i + 1), "TOP").ok).filter(Boolean);
  expect(passed.length).toBeGreaterThanOrEqual(9);
});

// [상황] 흔들려 흐린 사진 10장을 검사한다.
// [기대] 9장 이상이 "흔들림"으로 걸러진다.
test("흔들린 시험 사진 10장 중 9장 이상이 흔들림으로 걸러진다", () => {
  const caught = Array.from({ length: 10 }, (_, i) => checkQuality(blurredGray(i + 1), "TOP").reason).filter((r) => r === "BLUR");
  expect(caught.length).toBeGreaterThanOrEqual(9);
});

// [상황] 가운데가 반사로 하얗게 날아간 윗면 사진을 검사한다.
// [기대] "반사"로 걸러진다(반사 속 흠집은 안 보임).
test("강한 빛 반사가 있는 사진은 반사로 걸러진다", () => {
  expect(checkQuality(glareGray(), "TOP")).toMatchObject({ ok: false, reason: "GLARE" });
});

// [상황] 같은 밝은 사진을 흰 화면(SCR1) 면으로 검사한다.
// [기대] 흰 화면은 원래 밝으니 반사로 거르지 않는다.
test("흰 화면(SCR1)은 밝아도 반사로 거르지 않는다", () => {
  expect(checkQuality(glareGray(), "SCR1").ok).toBe(true);
});

// [상황] 흰 점과 검은 점 두 개짜리 컬러 그림을 밝기로 바꾼다.
// [기대] 255와 0이 된다.
test("RGBA를 밝기로 바꾼다", () => {
  const g = toGray({ width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) });
  expect([...g.data]).toEqual([255, 0]);
});

// [상황] 어두운 사진을 윗면과 흰 화면으로 검사한다.
// [기대] 둘 다 흔들림보다 먼저 "어두움"으로 걸러진다.
test("불을 끈 것처럼 어두운 사진은 흔들림보다 먼저 어두움으로 걸러진다", () => {
  expect(checkQuality(darkGray(), "TOP")).toMatchObject({ ok: false, reason: "DARK" });
  expect(checkQuality(darkGray(), "SCR1").reason).toBe("DARK");
});

// [상황] 찍기 전 미리보기 화면이 어둡거나, 반사가 있거나, 앞 화면과 달라 움직이거나, 괜찮다.
// [기대] 어두움 → 반사 → 움직임 순서로 알리고, 괜찮으면 OK다. 흰 화면은 반사를 알리지 않는다.
test("찍기 전 안내는 어두움, 반사, 움직임 순으로 알리고 괜찮으면 OK다", () => {
  expect(liveHint(darkGray(), null, "TOP")).toBe("DARK");
  expect(liveHint(glareGray(), null, "TOP")).toBe("GLARE");
  expect(liveHint(glareGray(), null, "SCR1")).toBe("OK");
  expect(liveHint(sharpGray(1), sharpGray(2), "TOP")).toBe("MOVING");
  expect(liveHint(sharpGray(1), sharpGray(1), "TOP")).toBe("OK");
  expect(liveHint(sharpGray(1), null, "BOT")).toBe("OK");
});

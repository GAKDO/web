import { readFileSync } from "node:fs";
import { PHONE_FACES, PHONE_REQUIRED_FACES } from "./faces";
import { checkQuality, liveHint, toGray } from "./quality";
import { blurredGray, darkGray, glareGray, sharpGray } from "./testing";

test("폰 필수 면은 contracts codes.yaml capture.face_required.PHONE과 같고 키보드는 찍지 않는다", () => {
  const yaml = readFileSync("contracts/codes.yaml", "utf8");
  const line = /^\s+PHONE:\s*\[([^\]]+)\]/m.exec(yaml);
  expect(line?.[1].split(",").map((s) => s.trim())).toEqual([...PHONE_REQUIRED_FACES]);
  expect(PHONE_FACES.filter((f) => f.required).map((f) => f.face)).toEqual([...PHONE_REQUIRED_FACES]);
  expect(PHONE_FACES.map((f) => f.face)).not.toContain("KB");
  expect(PHONE_FACES.find((f) => f.face === "SCR1")?.required).toBe(false);
});

test("선명한 시험 사진 10장 중 9장 이상이 통과한다", () => {
  const passed = Array.from({ length: 10 }, (_, i) => checkQuality(sharpGray(i + 1), "TOP").ok).filter(Boolean);
  expect(passed.length).toBeGreaterThanOrEqual(9);
});

test("흔들린 시험 사진 10장 중 9장 이상이 흔들림으로 걸러진다", () => {
  const caught = Array.from({ length: 10 }, (_, i) => checkQuality(blurredGray(i + 1), "TOP").reason).filter((r) => r === "BLUR");
  expect(caught.length).toBeGreaterThanOrEqual(9);
});

test("강한 빛 반사가 있는 사진은 반사로 걸러진다", () => {
  expect(checkQuality(glareGray(), "TOP")).toMatchObject({ ok: false, reason: "GLARE" });
});

test("흰 화면(SCR1)은 밝아도 반사로 거르지 않는다", () => {
  expect(checkQuality(glareGray(), "SCR1").ok).toBe(true);
});

test("RGBA를 밝기로 바꾼다", () => {
  const g = toGray({ width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) });
  expect([...g.data]).toEqual([255, 0]);
});

test("불을 끈 것처럼 어두운 사진은 흔들림보다 먼저 어두움으로 걸러진다", () => {
  expect(checkQuality(darkGray(), "TOP")).toMatchObject({ ok: false, reason: "DARK" });
  expect(checkQuality(darkGray(), "SCR1").reason).toBe("DARK");
});

test("찍기 전 안내는 어두움, 반사, 움직임 순으로 알리고 괜찮으면 OK다", () => {
  expect(liveHint(darkGray(), null, "TOP")).toBe("DARK");
  expect(liveHint(glareGray(), null, "TOP")).toBe("GLARE");
  expect(liveHint(glareGray(), null, "SCR1")).toBe("OK");
  expect(liveHint(sharpGray(1), sharpGray(2), "TOP")).toBe("MOVING");
  expect(liveHint(sharpGray(1), sharpGray(1), "TOP")).toBe("OK");
  expect(liveHint(sharpGray(1), null, "BOT")).toBe("OK");
});

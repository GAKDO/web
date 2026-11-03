import { archivedFeatures, isArchived } from "./features";

test("쉼표로 적은 보관 기능 이름만 읽고, 공백과 모르는 이름은 무시한다", () => {
  expect([...archivedFeatures("phoneCapture, report ,unknown,,pilot")]).toEqual(["phoneCapture", "report", "pilot"]);
});

test("비었거나 없으면 아무것도 숨기지 않는다", () => {
  expect(archivedFeatures("").size).toBe(0);
  expect(archivedFeatures(undefined).size).toBe(0);
  expect(isArchived("report", undefined)).toBe(false);
});

test("isArchived는 목록에 있는 기능만 true다", () => {
  expect(isArchived("diagnostics", "diagnostics,account")).toBe(true);
  expect(isArchived("phoneCapture", "diagnostics,account")).toBe(false);
});

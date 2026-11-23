// 이 파일이 확인하는 것: 보관(숨김) 기능 설정 읽기. MVP에서 잠시 멈춘 기능(폰 촬영, 리포트 등)을 환경 변수에 쉼표로 적으면 화면에서 숨긴다.

import { archivedFeatures, isArchived } from "./features";

// [상황] "phoneCapture, report ,unknown,,pilot"처럼 공백·모르는 이름·빈 칸이 섞여 있다.
// [기대] 아는 이름(phoneCapture, report, pilot)만 읽는다.
test("쉼표로 적은 보관 기능 이름만 읽고, 공백과 모르는 이름은 무시한다", () => {
  expect([...archivedFeatures("phoneCapture, report ,unknown,,pilot")]).toEqual(["phoneCapture", "report", "pilot"]);
});

// [상황] 설정이 비었거나 없다.
// [기대] 아무 기능도 숨기지 않는다.
test("비었거나 없으면 아무것도 숨기지 않는다", () => {
  expect(archivedFeatures("").size).toBe(0);
  expect(archivedFeatures(undefined).size).toBe(0);
  expect(isArchived("report", undefined)).toBe(false);
});

// [상황] 진단·계정 기능을 보관으로 적었다.
// [기대] 목록에 있는 진단만 숨김이고, 폰 촬영은 숨기지 않는다.
test("isArchived는 목록에 있는 기능만 true다", () => {
  expect(isArchived("diagnostics", "diagnostics,account")).toBe(true);
  expect(isArchived("phoneCapture", "diagnostics,account")).toBe(false);
});

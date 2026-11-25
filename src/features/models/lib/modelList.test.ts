// 이 파일이 확인하는 것: 관리자 기종 목록의 정렬·검색·용량 표시 규칙.

import { formatGb, matchesModel, sortModels } from "./modelList";
import type { DeviceModelSummary } from "../../../shared/api/types";

// 테스트 도구: 기종 하나(코드·이름·제조사·사양)를 만든다.
const m = (modelCode: string, name: string, manufacturer: string | null, spec: DeviceModelSummary["spec"] = null): DeviceModelSummary => ({
  modelCode,
  name,
  manufacturer,
  formFactor: "CLAMSHELL",
  spec,
});

const list = [m("B-1", "나 기종", null, { ssdGb: 512 }), m("A-1", "가 기종", "LG", { ssdGb: 1024, gpu: "RTX 4060" }), m("C-1", "다 기종", "Apple")];

// [상황] 제조사가 Apple, LG, 없음인 기종을 제조사순으로 정렬한다.
// [기대] 제조사가 없는 기종은 맨 뒤에 둔다.
test("제조사순은 제조사가 없는 기종을 맨 뒤에 둔다", () => {
  expect(sortModels(list, "manufacturer").map((x) => x.modelCode)).toEqual(["C-1", "A-1", "B-1"]);
});

// [상황] 저장 공간이 1TB, 512GB, 사양 없음인 기종을 큰 순으로 정렬한다.
// [기대] 사양이 없는 기종은 맨 뒤에 둔다.
test("저장 공간 큰 순은 사양 없는 기종을 맨 뒤에 둔다", () => {
  expect(sortModels(list, "ssdDesc").map((x) => x.modelCode)).toEqual(["A-1", "B-1", "C-1"]);
});

// [상황] 검색어 "rtx"(소문자)로 찾는다.
// [기대] GPU가 RTX 4060인 기종이 찾아진다.
test("GPU 이름으로도 검색된다(대소문자 무시)", () => {
  expect(list.filter((x) => matchesModel(x, "rtx")).map((x) => x.modelCode)).toEqual(["A-1"]);
});

// [상황] 1024GB, 512GB, 값 없음을 표시한다.
// [기대] 각각 1TB, 512GB, -로 보인다.
test("1024GB 배수는 TB로, 없는 값은 -로 보인다", () => {
  expect(formatGb(1024)).toBe("1TB");
  expect(formatGb(512)).toBe("512GB");
  expect(formatGb(undefined)).toBe("-");
});

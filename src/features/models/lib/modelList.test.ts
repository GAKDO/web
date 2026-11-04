import { formatGb, matchesModel, sortModels } from "./modelList";
import type { DeviceModelSummary } from "../../../shared/api/types";

const m = (modelCode: string, name: string, manufacturer: string | null, spec: DeviceModelSummary["spec"] = null): DeviceModelSummary => ({
  modelCode,
  name,
  manufacturer,
  formFactor: "CLAMSHELL",
  spec,
});

const list = [m("B-1", "나 기종", null, { ssdGb: 512 }), m("A-1", "가 기종", "LG", { ssdGb: 1024, gpu: "RTX 4060" }), m("C-1", "다 기종", "Apple")];

test("제조사순은 제조사가 없는 기종을 맨 뒤에 둔다", () => {
  expect(sortModels(list, "manufacturer").map((x) => x.modelCode)).toEqual(["C-1", "A-1", "B-1"]);
});

test("저장 공간 큰 순은 사양 없는 기종을 맨 뒤에 둔다", () => {
  expect(sortModels(list, "ssdDesc").map((x) => x.modelCode)).toEqual(["A-1", "B-1", "C-1"]);
});

test("GPU 이름으로도 검색된다(대소문자 무시)", () => {
  expect(list.filter((x) => matchesModel(x, "rtx")).map((x) => x.modelCode)).toEqual(["A-1"]);
});

test("1024GB 배수는 TB로, 없는 값은 -로 보인다", () => {
  expect(formatGb(1024)).toBe("1TB");
  expect(formatGb(512)).toBe("512GB");
  expect(formatGb(undefined)).toBe("-");
});

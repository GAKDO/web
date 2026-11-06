import { matchModel, parseLabelText } from "./labelParse";
import type { DeviceModelSummary } from "../../../shared/api/types";

const models: DeviceModelSummary[] = [
  { modelCode: "MBA13-M2", name: "MacBook Air (M2, 2022)", manufacturer: "Apple", formFactor: "CLAMSHELL" },
  { modelCode: "MBP14-M3", name: "MacBook Pro 14 (M3, 2023)", manufacturer: "Apple", formFactor: "CLAMSHELL" },
  { modelCode: "LG-GRAM16", name: "LG gram 16 (2024)", manufacturer: "LG", formFactor: "CLAMSHELL" },
];

test("맥북 바닥 글자에서 시리얼과 모델 번호를 읽고 MacBook Air M2 기종을 고른다", () => {
  const text = "Designed by Apple in California Assembled in China\nModel A2681 EMC 4048 Serial: K7QX2M9P4T  Li-ion 52.6Wh";
  const r = parseLabelText(text);
  expect(r).toEqual({ serial: "K7QX2M9P4T", modelNumber: "A2681", manufacturer: "Apple", os: "MACOS" });
  expect(matchModel(r, models)).toBe("MBA13-M2");
});

test("OCR이 시리얼 중간을 띄어 읽어도 한 덩어리로 붙인다", () => {
  expect(parseLabelText("Serial No. C02 XYZ1234").serial).toBe("C02XYZ1234");
});

test("LG 그램 라벨의 S/N과 Model을 읽고 제조사가 같은 기종 하나를 고른다", () => {
  const text = "LG Electronics Inc.\nModel: 16Z90R-K.AAC8U1\nS/N: 403QCZP123456\nRating 20V 3.25A";
  const r = parseLabelText(text);
  expect(r.serial).toBe("403QCZP123456");
  expect(r.modelNumber).toBe("16Z90R-K");
  expect(r.os).toBe("WINDOWS");
  expect(matchModel(r, models)).toBe("LG-GRAM16");
});

test("델 서비스 태그를 시리얼로 읽는다", () => {
  const r = parseLabelText("DELL Inc.\nService Tag (S/N): 7HXK2Q3\nReg Model: P54G");
  expect(r).toEqual({ serial: "7HXK2Q3", modelNumber: "P54G", manufacturer: "Dell", os: "WINDOWS" });
  // 등록된 델 기종이 없으면 고르지 않는다
  expect(matchModel(r, models)).toBeNull();
});

test("기종 이름에 모델 번호를 넣어 둔 새 물건도 그 기종으로 맞춰진다", () => {
  const extra = [...models, { modelCode: "CAM-1", name: "Sony a7 IV (ILCE-7M4)", manufacturer: "Sony", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "ILCE7M4", manufacturer: null, os: null }, extra)).toBeNull();
  expect(matchModel({ serial: null, modelNumber: "ILCE-7M4", manufacturer: null, os: null }, extra)).toBe("CAM-1");
});

test("글자를 못 읽으면 모든 값이 null이고 기종도 고르지 않는다", () => {
  const r = parseLabelText("~~ ## ..");
  expect(r).toEqual({ serial: null, modelNumber: null, manufacturer: null, os: null });
  expect(matchModel(r, models)).toBeNull();
});

test("Apple 기종이 둘이라 모델 번호가 표에 없으면 기종을 고르지 않는다", () => {
  expect(matchModel({ serial: "X", modelNumber: "A9999", manufacturer: "Apple", os: "MACOS" }, models)).toBeNull();
});

test("Serial 머리말과 값이 다른 줄로 나뉘어 읽혀도 시리얼을 찾는다", () => {
  expect(parseLabelText("Model A2681\nSerial:\nK7QX2M9P4T\nEMC 4048").serial).toBe("K7QX2M9P4T");
});

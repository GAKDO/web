// 이 파일이 확인하는 것: 노트북 바닥 라벨 사진에서 읽은 글자(OCR 결과)로 시리얼·모델 번호·제조사·OS를 뽑고(parseLabelText),
// 등록된 기종 중 하나를 고르는(matchModel) 규칙. 확실하지 않으면 고르지 않고 비워 둬서 관리자가 직접 넣게 한다.

import { matchModel, parseLabelText } from "./labelParse";
import type { DeviceModelSummary } from "../../../shared/api/types";

// 테스트 도구: 등록된 기종 3개(MacBook Air M2, MacBook Pro 14 M3, LG gram 16)를 흉내 낸 목록.
const models: DeviceModelSummary[] = [
  { modelCode: "MBA13-M2", name: "MacBook Air (M2, 2022)", manufacturer: "Apple", formFactor: "CLAMSHELL" },
  { modelCode: "MBP14-M3", name: "MacBook Pro 14 (M3, 2023)", manufacturer: "Apple", formFactor: "CLAMSHELL" },
  { modelCode: "LG-GRAM16", name: "LG gram 16 (2024)", manufacturer: "LG", formFactor: "CLAMSHELL" },
];

// [상황] 맥북 바닥 글자 "Model A2681 … Serial: K7QX2M9P4T"를 읽었다.
// [기대] 시리얼·모델 번호 A2681·Apple·macOS를 뽑고, A2681이 MacBook Air M2라서 그 기종을 고른다.
test("맥북 바닥 글자에서 시리얼과 모델 번호를 읽고 MacBook Air M2 기종을 고른다", () => {
  const text = "Designed by Apple in California Assembled in China\nModel A2681 EMC 4048 Serial: K7QX2M9P4T  Li-ion 52.6Wh";
  const r = parseLabelText(text);
  expect(r).toEqual({ serial: "K7QX2M9P4T", modelNumber: "A2681", manufacturer: "Apple", os: "MACOS" });
  expect(matchModel(r, models)).toBe("MBA13-M2");
});

// [상황] 글자 읽기가 시리얼을 "C02 XYZ1234"처럼 띄어 읽었다.
// [기대] "C02XYZ1234" 한 덩어리로 붙인다.
test("OCR이 시리얼 중간을 띄어 읽어도 한 덩어리로 붙인다", () => {
  expect(parseLabelText("Serial No. C02 XYZ1234").serial).toBe("C02XYZ1234");
});

// [상황] LG 그램 라벨의 "Model: 16Z90R-K.AAC8U1", "S/N: 403QCZP123456"을 읽었다.
// [기대] 시리얼과 모델 번호 16Z90R-K, Windows를 뽑고, 제조사가 LG인 기종 하나(LG gram 16)를 고른다.
test("LG 그램 라벨의 S/N과 Model을 읽고 제조사가 같은 기종 하나를 고른다", () => {
  const text = "LG Electronics Inc.\nModel: 16Z90R-K.AAC8U1\nS/N: 403QCZP123456\nRating 20V 3.25A";
  const r = parseLabelText(text);
  expect(r.serial).toBe("403QCZP123456");
  expect(r.modelNumber).toBe("16Z90R-K");
  expect(r.os).toBe("WINDOWS");
  expect(matchModel(r, models)).toBe("LG-GRAM16");
});

// [상황] 델 라벨의 "Service Tag (S/N): 7HXK2Q3"을 읽었다.
// [기대] 서비스 태그를 시리얼로 쓴다. 등록된 델 기종이 없으므로 기종은 고르지 않는다.
test("델 서비스 태그를 시리얼로 읽는다", () => {
  const r = parseLabelText("DELL Inc.\nService Tag (S/N): 7HXK2Q3\nReg Model: P54G");
  expect(r).toEqual({ serial: "7HXK2Q3", modelNumber: "P54G", manufacturer: "Dell", os: "WINDOWS" });
  // 등록된 델 기종이 없으면 고르지 않는다
  expect(matchModel(r, models)).toBeNull();
});

// [상황] 기종 이름에 모델 번호를 넣어 둔 물건("Sony a7 IV (ILCE-7M4)")이 있다.
// [기대] 라벨의 모델 번호가 정확히 같을 때(ILCE-7M4)만 그 기종을 고르고, 하이픈이 빠진 ILCE7M4는 고르지 않는다.
test("기종 이름에 모델 번호를 넣어 둔 새 물건도 그 기종으로 맞춰진다", () => {
  const extra = [...models, { modelCode: "CAM-1", name: "Sony a7 IV (ILCE-7M4)", manufacturer: "Sony", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "ILCE7M4", manufacturer: null, os: null }, extra)).toBeNull();
  expect(matchModel({ serial: null, modelNumber: "ILCE-7M4", manufacturer: null, os: null }, extra)).toBe("CAM-1");
});

// [상황] 의미 없는 글자만 읽혔다.
// [기대] 모든 값이 비어 있고(null) 기종도 고르지 않는다.
test("글자를 못 읽으면 모든 값이 null이고 기종도 고르지 않는다", () => {
  const r = parseLabelText("~~ ## ..");
  expect(r).toEqual({ serial: null, modelNumber: null, manufacturer: null, os: null });
  expect(matchModel(r, models)).toBeNull();
});

// [상황] Apple 기종이 2개 등록돼 있는데, 읽은 모델 번호 A9999가 아는 표에 없다.
// [기대] 아무 Apple 기종이나 고르지 않는다.
test("Apple 기종이 둘이라 모델 번호가 표에 없으면 기종을 고르지 않는다", () => {
  expect(matchModel({ serial: "X", modelNumber: "A9999", manufacturer: "Apple", os: "MACOS" }, models)).toBeNull();
});

// [상황] "Serial:" 다음 줄에 시리얼 값이 읽혔다.
// [기대] 다음 줄의 값을 시리얼로 찾는다.
test("Serial 머리말과 값이 다른 줄로 나뉘어 읽혀도 시리얼을 찾는다", () => {
  expect(parseLabelText("Model A2681\nSerial:\nK7QX2M9P4T\nEMC 4048").serial).toBe("K7QX2M9P4T");
});

// [상황] 모델 번호 P54G가 다른 기종 이름 "XP54G7"의 일부로만 들어 있다.
// [기대] 그 기종을 고르지 않는다(글자 일부가 겹친다고 같은 물건이 아님).
test("모델 번호가 다른 코드의 일부로만 들어 있으면 그 기종을 고르지 않는다", () => {
  const extra = [{ modelCode: "XP54G7", name: "Other XP54G7", manufacturer: "Acme", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "P54G", manufacturer: null, os: null }, extra)).toBeNull();
});

// [상황] "Serial:" 뒤가 비어 있고 다음 줄이 "Model A2681"이다.
// [기대] 모델 글자를 시리얼로 잘못 쓰지 않고 시리얼은 비운다. 모델 번호는 A2681로 읽는다.
test("Serial 머리말 뒤 값이 비고 다음 줄이 Model이면 모델 글자를 시리얼로 쓰지 않는다", () => {
  const r = parseLabelText("Serial:\nModel A2681\nEMC 4048");
  expect(r.serial).toBeNull();
  expect(r.modelNumber).toBe("A2681");
});

// [상황] 모델 번호 Z900이 두 기종과 맞고, 읽은 제조사는 LG인데 LG 기종은 모델 번호가 다르다.
// [기대] 제조사만 같은 다른 기종을 고르지 않는다.
test("모델 번호가 여러 기종과 맞으면 제조사만 같은 다른 기종을 고르지 않는다", () => {
  const list = [
    { modelCode: "X1-A", name: "Acme Z900", manufacturer: "Acme", formFactor: "CLAMSHELL" as const },
    { modelCode: "X1-B", name: "Other Z900", manufacturer: "Other", formFactor: "CLAMSHELL" as const },
    { modelCode: "LG-1", name: "LG gram", manufacturer: "LG", formFactor: "CLAMSHELL" as const },
  ];
  expect(matchModel({ serial: null, modelNumber: "Z900", manufacturer: "LG", os: "WINDOWS" }, list)).toBeNull();
});

// [상황] 모델 번호 Z900이 맞는 기종이 하나 있다. 한 번은 제조사를 Dell로 읽었고, 한 번은 제조사를 못 읽었다.
// [기대] 제조사가 다르면 고르지 않고, 제조사를 못 읽었으면 모델 번호로 그 기종을 고른다.
test("제조사를 읽었으면 모델 번호가 맞아도 제조사가 다른 기종은 고르지 않는다", () => {
  const list = [{ modelCode: "X1-B", name: "Other Z900", manufacturer: "Other", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "Z900", manufacturer: "Dell", os: "WINDOWS" }, list)).toBeNull();
  expect(matchModel({ serial: null, modelNumber: "Z900", manufacturer: null, os: null }, list)).toBe("X1-B");
});

// [상황] 모델 번호는 Apple 번호(A2681)인데 제조사를 Dell로 읽었다.
// [기대] Apple 모델 번호 표로 기종을 고르지 않는다.
test("Apple이 아닌 제조사로 읽었으면 Apple 모델 번호 표로 기종을 고르지 않는다", () => {
  expect(matchModel({ serial: null, modelNumber: "A2681", manufacturer: "Dell", os: "WINDOWS" }, models)).toBeNull();
});

// [상황] Apple 모델 번호 A2681과 이름이 같은 기종이 있지만 그 기종의 제조사가 Dell로 등록돼 있다.
// [기대] 제조사가 달라 고르지 않는다.
test("Apple 모델 번호 표로 고를 때도 제조사가 다른 기종은 고르지 않는다", () => {
  const odd = [{ modelCode: "ODD", name: "MacBook Air (M2, 2022)", manufacturer: "Dell", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "A2681", manufacturer: "Apple", os: "MACOS" }, odd)).toBeNull();
});

// [상황] MacBook Air M2만 등록돼 있는데, 다른 맥(A2337)의 라벨을 읽었다.
// [기대] 같은 Apple이라는 이유만으로 M2를 채우지 않는다. A2681일 때만 M2를 고른다.
test("아는 Apple 모델 번호가 등록된 기종과 맞지 않으면 제조사만으로 다른 기종을 채우지 않는다", () => {
  const onlyM2 = [{ modelCode: "MBA13-M2", name: "MacBook Air (M2, 2022)", manufacturer: "Apple", formFactor: "CLAMSHELL" as const }];
  expect(matchModel({ serial: null, modelNumber: "A2337", manufacturer: "Apple", os: "MACOS" }, onlyM2)).toBeNull();
  expect(matchModel({ serial: null, modelNumber: "A2681", manufacturer: "Apple", os: "MACOS" }, onlyM2)).toBe("MBA13-M2");
});

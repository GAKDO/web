// 이 파일이 확인하는 것: 로그인 없이 누구나 보는 "보유 노트북" 화면(/devices). 빌릴 수 있는 노트북마다 최근 검사 등급·흠집 수·배터리·성능을
// 표로 비교하고, 상세에서는 부스 사진의 흠집을 3D 노트북 모형 위 핀으로 보여 준다. 흠집마다 처음 발견된 검사도 알려 준다.
// 시리얼 같은 개인 식별 정보는 드러내지 않는다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderApp } from "../../test/renderApp";
import { server } from "../../shared/mocks/node";
import { db } from "../../shared/mocks/db";
import type { CatalogDevice, CatalogDiagnostics, CatalogInspectionSummary, CatalogPhotoDefect, ModelDimensions } from "../../shared/api/types";
import { filterRows, mergeCatalog, sortRows } from "./model/catalog";
import { FRAME, faceRatio, laptopPins, placeOnLaptop } from "./model/laptop3d";
import { firstSeenOf, type InspectionSpots } from "./model/firstSeen";

// 테스트 도구: 3D 모형 크기. 가로 300mm·깊이 200mm·본체 두께 10mm·덮개 두께 6mm.
const DIMS: ModelDimensions = { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 6 };

// 테스트 도구: 공개 목록용 노트북 한 대(Apple M2·16GB·256GB, 대여 가능)를 원하는 시점 목록과 함께 만든다. 시점 목록은 앞이 최근이다.
function device(id: string, name: string, checkpointIds: string[], extra: Partial<CatalogDevice> = {}): CatalogDevice {
  return {
    deviceId: id.padEnd(21, "x"),
    modelCode: "MBA13-M2",
    modelName: name,
    manufacturer: "Apple",
    os: "MACOS",
    color: null,
    status: "ACTIVE",
    available: true,
    rentalCount: 1,
    spec: { cpu: "Apple M2", ramGb: 16, ssdGb: 256 },
    dimensions: DIMS,
    checkpoints: checkpointIds.map((c) => ({ checkpointId: c, type: "OUT", status: "SEALED", occurredAt: null })),
    ...extra,
  };
}
// 테스트 도구: 한 시점의 공개 검사 요약(등급, 흠집 수는 모두 긁힘으로 침).
const summary = (checkpointId: string, defectCount: number, grade: "A" | "B" | "C" | "D"): CatalogInspectionSummary => ({
  checkpointId,
  grade,
  gradedAt: "2026-11-08T10:00:00+09:00",
  defectCount,
  defectsByClass: { scratch: defectCount, dent: 0, crack: 0, stain: 0 },
});
// 테스트 도구: 한 시점의 공개 진단 요약(배터리 최대 용량 %, CPU 단일 코어 점수).
const diag = (checkpointId: string, pct: number, single: number): CatalogDiagnostics => ({
  checkpointId,
  collectedAt: "2026-11-08T10:00:00+09:00",
  os: "MACOS",
  battery: { cycleCount: 100, designCapacity: 100, fullChargeCapacity: pct, capacityUnit: "mAh", maxCapacityPct: pct, condition: "NORMAL", skippedReason: null },
  ssd: null,
  benchmarks: [{ metric: "CPU_SINGLE", median: single }],
});

// 테스트 묶음: 표에 쓸 값을 모으고 정렬·검색하는 계산. Air A(최근 반납 B등급 흠집 1, 출고 C등급 흠집 5·배터리 88%),
// Air B(출고 A등급 흠집 0·배터리 95%, 색상 미드나이트, 대여 중), Gram C(검사·진단 없음) 세 대로 시험한다.
describe("공개 보유 기기 목록 모델", () => {
  const rows = mergeCatalog(
    [device("a", "Air A", ["ret-a", "out-a"]), device("b", "Air B", ["out-b"], { color: "미드나이트", available: false }), device("c", "Gram C", [])],
    [summary("out-a", 5, "C"), summary("ret-a", 1, "B"), summary("out-b", 0, "A")],
    [diag("out-a", 88, 1500), diag("out-b", 95, 1200)],
  );

  // [상황] Air A는 최근 반납 시점에 검사 요약만, 그 전 출고 시점에 검사와 진단이 있다.
  // [기대] 흠집 수는 가장 최근 검사(반납, 1개)를, 배터리는 진단이 있는 가장 최근 시점(출고, 88%)을 쓴다. 검사 없는 Gram C는 등급이 없다.
  test("기기마다 시점 목록 앞(최근)에서 흠집 요약·진단이 있는 첫 시점을 쓴다", () => {
    expect(rows[0].defectCount).toBe(1); // ret-a가 out-a보다 최근
    expect(rows[0].maxCapacityPct).toBe(88); // 진단은 out-a에만
    expect(rows[2].grade).toBeNull();
  });

  // [상황] 흠집 수·배터리·등급·CPU 점수로 오름차순·내림차순 정렬한다.
  // [기대] 값대로 정렬되고, 값이 없는 Gram C는 어느 방향이든 맨 뒤에 온다.
  test("흠집 적은 순·배터리 높은 순으로 정렬하고, 값이 없는 기기는 방향과 상관없이 맨 뒤", () => {
    expect(sortRows(rows, "defectCount", "asc").map((r) => r.device.modelName)).toEqual(["Air B", "Air A", "Gram C"]);
    expect(sortRows(rows, "defectCount", "desc").map((r) => r.device.modelName)).toEqual(["Air A", "Air B", "Gram C"]);
    expect(sortRows(rows, "maxCapacityPct", "desc").map((r) => r.device.modelName)).toEqual(["Air B", "Air A", "Gram C"]);
    expect(sortRows(rows, "grade", "asc").map((r) => r.grade)).toEqual(["A", "B", null]);
    expect(sortRows(rows, "CPU_SINGLE", "desc").map((r) => r.bench.CPU_SINGLE)).toEqual([1500, 1200, null]);
  });

  // [상황] "gram", 띄어 쓴 "미드 나이트", 대여 가능만 켠 채 "apple m2"로 검색한다.
  // [기대] 각각 Gram C, Air B, 대여 가능한 Air A·Gram C만 남는다(띄어쓰기·대소문자 무시).
  test("검색은 기종·색상·CPU를 띄어쓰기·대소문자 없이 찾고, 대여 가능만 거를 수 있다", () => {
    expect(filterRows(rows, { q: "gram", availableOnly: false }).map((r) => r.device.modelName)).toEqual(["Gram C"]);
    expect(filterRows(rows, { q: "미드 나이트", availableOnly: false }).map((r) => r.device.modelName)).toEqual(["Air B"]);
    expect(filterRows(rows, { q: "apple m2", availableOnly: true }).map((r) => r.device.modelName)).toEqual(["Air A", "Gram C"]);
  });
});

// 테스트 묶음: 부스 카메라 사진 속 흠집 위치를 3D 모형 위 자리로 옮기는 계산. 부스 위쪽 카메라 두 대(CAM1·CAM2)는 비스듬히 찍으므로
// 사진마다 면의 네 모서리 위치(FRAME)로 보정한다.
describe("부스 사진 흠집 → 3D 핀", () => {
  // [상황] 카메라마다 보정용 네 모서리 점을 면 위치로 바꾼다. 사진 밖(여백) 점도 넣어 본다.
  // [기대] 네 모서리가 면의 네 모서리로 간다. 바닥은 뒤로 넘겨 찍어 180° 돌아 있으므로 사진 왼쪽 위가 면의 오른쪽 아래가 된다.
  //        사진 밖 점은 면 끝으로 붙인다.
  test("위 카메라 두 대는 각자 면 전체를 찍는다: 보정한 네 모서리는 면의 네 모서리로 간다", () => {
    const size = { width: 1, height: 1 };
    const close = (got: { u: number; v: number }, want: { u: number; v: number }) => {
      expect(got.u).toBeCloseTo(want.u, 6);
      expect(got.v).toBeCloseTo(want.v, 6);
    };
    for (const camera of ["CAM1", "CAM2"] as const) {
      const [tl, tr, br, bl] = FRAME[camera];
      close(faceRatio("TOP", camera, tl, size), { u: 0, v: 0 });
      close(faceRatio("TOP", camera, tr, size), { u: 1, v: 0 });
      close(faceRatio("TOP", camera, br, size), { u: 1, v: 1 });
      close(faceRatio("KB", camera, bl, size), { u: 0, v: 1 });
      // 바닥은 뒤로 넘겨 찍어 180° 돌아 있다: 사진 왼쪽 위 = 표준 면 오른쪽 아래
      close(faceRatio("BOT", camera, tl, size), { u: 1, v: 1 });
    }
    // 사진 밖(여백)은 면 끝으로 붙인다
    expect(faceRatio("TOP", "CAM1", [0, 0], size)).toEqual({ u: 0, v: 0 });
  });

  // [상황] 11/5~11/6 실제 부스 사진에서 같은 흠집 4개의 위치를 CAM1·CAM2 사진에서 각각 쟀다.
  // [기대] 두 카메라 사진으로 옮긴 3D 자리가 2cm 안에서 만난다(두 카메라가 본 흠집을 같은 흠집으로 묶을 수 있음).
  test("실제 부스 사진의 같은 흠집은 CAM1·CAM2 어느 사진으로 옮겨도 2cm 안에서 만난다", () => {
    // 11/5~11/6 부스 사진(1920×1080)에서 잰 같은 흠집 위치(사진 비율): [면, CAM1 위치, CAM2 위치]
    const pairs: ["TOP" | "BOT", [number, number], [number, number]][] = [
      ["TOP", [0.375, 0.767], [0.448, 0.736]], // MB07 윗면 scratch
      ["TOP", [0.737, 0.738], [0.808, 0.726]], // MB13 윗면 dent
      ["BOT", [0.717, 0.57], [0.802, 0.573]], // MB08 바닥 scratch
      ["BOT", [0.181, 0.551], [0.242, 0.524]], // MB02 바닥 dent
    ];
    const size = { width: 1, height: 1 };
    for (const [face, p1, p2] of pairs) {
      const a = placeOnLaptop(face, faceRatio(face, "CAM1", p1, size), DIMS).position;
      const b = placeOnLaptop(face, faceRatio(face, "CAM2", p2, size), DIMS).position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(20);
    }
  });

  // [상황] 바닥 사진 왼쪽 위 모서리를 3D 자리로 옮긴다.
  // [기대] 사용자 기준 왼쪽·앞쪽 모서리에 놓인다(앞 모서리를 들어 뒤로 넘겨 찍기 때문).
  test("바닥 사진 왼쪽은 사용자 왼쪽, 사진 위쪽은 앞 모서리(앞 모서리를 들어 뒤로 넘겨 찍음)", () => {
    const size = { width: 1, height: 1 };
    const [tl] = FRAME.CAM1;
    const corner = placeOnLaptop("BOT", faceRatio("BOT", "CAM1", tl, size), DIMS);
    expect(corner.position[0]).toBeLessThan(0); // 왼쪽
    expect(corner.position[2]).toBeGreaterThan(0); // 앞
  });

  // [상황] 폰 사진(1000×1000)의 (250, 500) 점을 면 위치로 바꾼다.
  // [기대] 보정 없이 비율 그대로 (0.25, 0.5)다.
  test("폰 사진은 사진 전체가 면이다", () => {
    expect(faceRatio("TOP", "PHONE", [250, 500], { width: 1000, height: 1000 })).toEqual({ u: 0.25, v: 0.5 });
  });

  // [상황] 윗면·바닥·앞쪽 옆면의 점을 3D 자리로 옮긴다.
  // [기대] 윗면은 덮개(lid)에, 바닥은 본체(base)에 놓인다. 옆면은 아래쪽이면 본체, 위쪽이면 덮개 모서리다.
  test("덮개(윗면) 핀은 덮개 좌표에, 키보드·바닥 핀은 본체 좌표에 놓인다", () => {
    expect(placeOnLaptop("TOP", { u: 0.5, v: 0 }, DIMS)).toEqual({ part: "lid", position: [0, 6, 0], normal: [0, 1, 0] });
    expect(placeOnLaptop("BOT", { u: 0, v: 1 }, DIMS)).toEqual({ part: "base", position: [150, -5, 100], normal: [0, -1, 0] });
    // 옆면 아래쪽(본체)과 위쪽(덮개 모서리)
    expect(placeOnLaptop("SF", { u: 0.5, v: 1 }, DIMS).part).toBe("base");
    expect(placeOnLaptop("SF", { u: 0.5, v: 0 }, DIMS).part).toBe("lid");
  });

  // [상황] 같은 흠집으로 묶인 긁힘·찍힘 2개와, 따로인 얼룩 1개가 있다.
  // [기대] 핀은 2개이고, 묶인 핀의 종류는 더 심한 "찍힘"이며 묶음에 2개가 들어 있다.
  test("같은 흠집 묶음은 핀 하나, 종류는 묶음에서 가장 심한 것", () => {
    const d = (id: string, groupId: string, cls: CatalogPhotoDefect["class"]): CatalogPhotoDefect => ({
      defectId: id.padEnd(21, "d"),
      face: "TOP",
      light: "L1",
      camera: "CAM1",
      class: cls,
      polygon: [[10, 10], [20, 10], [20, 20]],
      groupId: groupId.padEnd(21, "d"),
    });
    const pins = laptopPins([d("g1", "g1", "scratch"), d("g2", "g1", "dent"), d("g3", "g3", "stain")], DIMS, () => undefined);
    expect(pins).toHaveLength(2);
    expect(pins[0].defectClass).toBe("dent");
    expect(pins[0].members).toHaveLength(2);
  });
});

// 테스트 묶음: 실제 화면을 열어 표와 상세를 확인한다.
describe("보유 노트북 화면", () => {
  // [상황] 로그인하지 않고 보유 노트북 화면을 연 뒤 "흠집" 열 머리를 누른다.
  // [기대] 폐기하지 않은 노트북 수만큼 줄이 있고, 기본은 흠집 적은 순(0개가 맨 위, 검사 전은 맨 뒤)이다.
  //        누르면 흠집 많은 순(2개가 맨 위)으로 바뀐다. 폐기한 기기는 목록에 없다.
  test("로그인 없이 목록이 열리고, 흠집 열을 누르면 흠집 많은 순으로 바뀌며 폐기 기기는 없다", async () => {
    const user = userEvent.setup();
    const quick = db.rentals.find((r) => r.renterRef === "R-1002")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== quick.deviceId || r === quick);
    renderApp("/devices");
    expect(await screen.findByRole("heading", { name: "보유 노트북" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    const active = db.devices.filter((d) => d.status !== "RETIRED").length;
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(active + 1));
    // 기본은 흠집 적은 순: 검사 전 기기(—)는 맨 뒤
    const firstBody = () => within(table).getAllByRole("row")[1];
    expect(within(firstBody()).getByText("0개")).toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: /흠집/ }));
    expect(within(table).getByRole("columnheader", { name: /흠집/ })).toHaveAttribute("aria-sort", "descending");
    expect(within(firstBody()).getByText("2개")).toBeInTheDocument();
    expect(screen.queryByText("C02PRO0002")).not.toBeInTheDocument();
  });

  // [상황] "gram"으로 검색했다가 없는 이름으로 검색한다.
  // [기대] gram 노트북만 남고, 없는 이름이면 "조건에 맞는 노트북이 없습니다."가 보인다.
  test("검색어에 맞는 노트북만 남고, 없으면 안내한다", async () => {
    const user = userEvent.setup();
    renderApp("/devices");
    const box = await screen.findByRole("searchbox", { name: "노트북 검색" });
    await screen.findByRole("table");
    await user.type(box, "gram");
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("link").every((a) => a.textContent?.includes("gram"))).toBe(true));
    await user.clear(box);
    await user.type(box, "없는기종");
    expect(await screen.findByText("조건에 맞는 노트북이 없습니다.")).toBeInTheDocument();
  });

  // [상황] 가장 최근 검사가 부스 빠른 검사인 노트북의 상세를 연다. 테스트 환경은 3D를 그릴 수 없다.
  // [기대] 3D를 볼 수 없다는 안내, "확정된 흠집 2개" 목록, 부스 사진 12장이 보인다. 찍힘을 누르면 사진 1장에 찍힌 흠집이라는 설명이 나온다.
  //        시리얼은 화면 어디에도 없다.
  test("상세는 확정 흠집 목록과 부스 사진을 보이고, 3D를 못 쓰는 브라우저에서는 사진 보기로 안내한다", async () => {
    const user = userEvent.setup();
    const quick = db.rentals.find((r) => r.renterRef === "R-1002")!;
    // 이 기기의 가장 최근 검사가 빠른 검사(QUICK)가 되도록 다른 렌탈은 뺀다
    db.rentals = db.rentals.filter((r) => r.deviceId !== quick.deviceId || r === quick);
    renderApp(`/devices/${quick.deviceId}`);
    expect(await screen.findByRole("heading", { name: /외관과 흠집 위치/ })).toBeInTheDocument();
    expect(await screen.findByText(/이 브라우저에서는 3D를 볼 수 없습니다/)).toBeInTheDocument();
    const list = await screen.findByRole("complementary", { name: "흠집 목록" });
    expect(await within(list).findByText("확정된 흠집 2개")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /찍힘/ }));
    expect(within(list).getByText(/사진 1장에 찍힌 흠집/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "부스 사진 12장" })).toBeInTheDocument();
    expect(screen.queryByText(/C02PRO0001/)).not.toBeInTheDocument();
  });
  // [상황] 검사·진단 기록이 하나도 없는 노트북이 있는 목록을 연다.
  // [기대] 빈칸 대신 "아직 부스 검사와 진단 기록이 없습니다"가 보이고, 등급은 "(문제 없음)" 같은 뜻과 함께 보이며 "표 읽는 법"이 있다.
  test("등급은 뜻과 함께 읽히고, 검사·진단 기록이 없는 노트북은 빈칸 대신 이유 한 줄을 보인다", async () => {
    const target = db.devices.find((dv) => dv.status !== "RETIRED")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== target.deviceId);
    renderApp("/devices");
    expect((await screen.findAllByText("아직 부스 검사와 진단 기록이 없습니다")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\((문제 없음|가벼운 긁힘|수리 검토|수리 필요)\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "표 읽는 법" })).toBeInTheDocument();
  });
  // [상황] 검사 기록이 없는 노트북의 상세를 연다.
  // [기대] 기종 외관 구역은 보이고, 흠집 목록은 "검사 전"으로 안내한다(불러오는 중이나 사진 안내는 없음).
  test("검사 전 노트북도 기종 3D 외관은 보이고, 흠집 대신 검사 전이라고 안내한다", async () => {
    const target = db.devices.find((dv) => dv.status !== "RETIRED")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== target.deviceId);
    renderApp(`/devices/${target.deviceId}`);
    expect(await screen.findByRole("heading", { name: /외관과 흠집 위치/ })).toBeInTheDocument();
    expect(await screen.findByText(/이 브라우저에서는 3D를 볼 수 없습니다/)).toBeInTheDocument();
    const list = screen.getByRole("complementary", { name: "흠집 목록" });
    expect(within(list).getByRole("heading", { name: "검사 전" })).toBeInTheDocument();
    expect(screen.queryByText(/흠집 위치를 불러오는 중/)).not.toBeInTheDocument();
    expect(screen.queryByText(/아래 부스 사진에서/)).not.toBeInTheDocument();
  });
  // [상황] 검사한 노트북인데 흠집 요약을 주는 서버에 닿지 못한다.
  // [기대] "검사 전"으로 속이지 않고 "흠집 기록을 불러오지 못했습니다"와 "다시 시도"를 보인다.
  test("흠집 요약을 못 불러오면 검사한 노트북을 검사 전으로 안내하지 않고 다시 시도를 보인다", async () => {
    const quick = db.rentals.find((r) => r.renterRef === "R-1002")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== quick.deviceId || r === quick);
    server.use(http.get("*/api/v1/captures/catalog", () => HttpResponse.error()));
    renderApp(`/devices/${quick.deviceId}`);
    const list = await screen.findByRole("complementary", { name: "흠집 목록" });
    expect(within(list).getByRole("heading", { name: "흠집 기록을 불러오지 못했습니다" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "검사 전" })).not.toBeInTheDocument();
  });
  // [상황] 공개 흠집 요약은 비어 있고(예: 폰 세트만 있음), 진단 조회만 실패한다.
  // [기대] 흠집 목록은 "검사 전"으로 보이고, 흠집 기록 오류 안내는 없다(진단 실패를 흠집 실패로 오해하지 않게).
  test("진단만 못 불러오면 흠집 기록 오류로 안내하지 않는다", async () => {
    const quick = db.rentals.find((r) => r.renterRef === "R-1002")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== quick.deviceId || r === quick);
    // 검사를 마친 시점은 있지만 공개 흠집 요약은 없고(예: 폰 세트만), 진단 조회만 실패한 경우
    server.use(
      http.get("*/api/v1/captures/catalog", () => HttpResponse.json({ items: [] })),
      http.get("*/api/v1/diagnostics/catalog", () => HttpResponse.error()),
    );
    renderApp(`/devices/${quick.deviceId}`);
    const list = await screen.findByRole("complementary", { name: "흠집 목록" });
    expect(within(list).getByRole("heading", { name: "검사 전" })).toBeInTheDocument();
    expect(within(list).queryByText("흠집 기록을 불러오지 못했습니다")).not.toBeInTheDocument();
  });
});

// 테스트 묶음: 이번 검사의 흠집이 이전 검사들에도 있었는지 찾아 "처음 발견된 검사"를 정하는 계산.
describe("흠집별 처음 발견 검사", () => {
  const spots = (checkpointId: string, type: InspectionSpots["type"], list: [string, InspectionSpots["spots"][number]["face"], number, number][]): InspectionSpots => ({
    checkpointId,
    type,
    gradedAt: "2026-11-03T10:00:00+09:00",
    spots: list.map(([groupId, face, u, v]) => ({ groupId, face, ratio: { u, v } })),
  });

  // [상황] 반납 검사에 바닥 흠집 a와 윗면 흠집 b가 있다. 중간 수령 검사엔 아무것도 없고, 출고 검사에 a 근처 바닥 흠집과 다른 자리 윗면 흠집이 있다.
  // [기대] a는 가장 오래된 출고 검사부터 있던 흠집(중간 검사에서 놓쳐도), b는 이번 반납에서 새로 생긴 흠집이다.
  test("이전 검사의 같은 면·가까운 위치 흠집은 가장 오래된 검사부터 있던 흠집으로, 없던 흠집은 새 흠집으로 본다", () => {
    const ret = spots("ret", "RET", [["a", "BOT", 0.3, 0.3], ["b", "TOP", 0.7, 0.5]]);
    const rcv = spots("rcv", "RCV", []); // 중간 검사에서 놓쳐도
    const out = spots("out", "OUT", [["x", "BOT", 0.33, 0.28], ["y", "TOP", 0.2, 0.5]]);
    const seen = firstSeenOf(ret, [rcv, out]);
    expect(seen.get("a")).toMatchObject({ checkpointId: "out", type: "OUT", isNew: false });
    expect(seen.get("b")).toMatchObject({ checkpointId: "ret", isNew: true });
  });

  // [상황] 반납 바닥 흠집과 같은 자리지만 윗면에 있는 출고 흠집이 있다. 따로, 이전 검사가 하나도 없는 경우도 본다.
  // [기대] 면이 다르면 같은 흠집이 아니므로 새 흠집이다. 이전 검사가 없으면 비교할 수 없으니 새 흠집이라 하지 않는다.
  test("다른 면의 같은 자리는 같은 흠집이 아니고, 이전 검사가 없으면 새 흠집이라 하지 않는다", () => {
    const ret = spots("ret", "RET", [["a", "BOT", 0.3, 0.3]]);
    expect(firstSeenOf(ret, [spots("out", "OUT", [["x", "TOP", 0.3, 0.3]])]).get("a")?.isNew).toBe(true);
    expect(firstSeenOf(ret, []).get("a")).toMatchObject({ checkpointId: "ret", isNew: false });
  });
});

// 테스트 묶음: 처음 발견 계산이 상세 화면 흠집 목록에 어떻게 보이는지.
describe("기기 상세의 처음 발견 표시", () => {
  // [상황] 11/3 출고 검사에 바닥 긁힘 1개, 11/9 반납 검사에 같은 자리 바닥 긁힘과 새 윗면 찍힘이 있는 노트북의 상세를 연다.
  // [기대] 바닥 긁힘은 "출고 검사(2026. 11. 3.)부터 있던 흠집", 찍힘은 "이번 반납 검사(2026. 11. 9.)에서 새로 발견"과 "새 흠집" 표시가 붙는다.
  //        요약 "이전 검사부터 있던 흠집 1 · 이번에 새로 발견 1"이 보이고, 찍힘을 누르면 처음 발견 정보가 나온다.
  test("흠집 목록에 처음 발견된 검사를 보이고, 이번 검사에서 생긴 흠집은 새 흠집으로 표시한다", async () => {
    const user = userEvent.setup();
    const dev = device("hist", "Air H", ["ret-h", "out-h"]);
    dev.checkpoints = [
      { checkpointId: "ret-h", type: "RET", status: "SEALED", occurredAt: "2026-11-09T17:00:00+09:00" },
      { checkpointId: "out-h", type: "OUT", status: "SEALED", occurredAt: "2026-11-03T10:00:00+09:00" },
    ];
    const pd = (id: string, face: CatalogPhotoDefect["face"], cls: CatalogPhotoDefect["class"], x: number, y: number): CatalogPhotoDefect => ({
      defectId: id.padEnd(21, "d"),
      face,
      light: "L1",
      camera: "CAM1",
      class: cls,
      polygon: [[x, y], [x + 10, y], [x + 10, y + 10]],
      groupId: id.padEnd(21, "d"),
    });
    const detail = {
      "ret-h": { gradedAt: "2026-11-09T17:48:00+09:00", defects: [pd("r1", "BOT", "scratch", 800, 500), pd("r2", "TOP", "dent", 1300, 400)] },
      "out-h": { gradedAt: "2026-11-03T10:30:00+09:00", defects: [pd("o1", "BOT", "scratch", 805, 505)] },
    } as const;
    server.use(
      http.get("*/api/v1/catalog/devices", () => HttpResponse.json({ items: [dev] })),
      http.get("*/api/v1/captures/catalog", () => HttpResponse.json({ items: [summary("ret-h", 2, "C"), summary("out-h", 1, "B")] })),
      http.get("*/api/v1/captures/catalog/checkpoints/:id", ({ params }) => {
        const d = detail[String(params.id) as keyof typeof detail];
        return HttpResponse.json({
          ...summary(String(params.id), d.defects.length, "C"),
          gradedAt: d.gradedAt,
          expiresAt: "2026-11-11T18:00:00+09:00",
          photos: d.defects.map((x) => ({ face: x.face, light: x.light, camera: x.camera, url: `https://example.test/${x.defectId}.jpg` })),
          photoDefects: d.defects,
        });
      }),
    );
    renderApp(`/devices/${dev.deviceId}`);
    const list = await screen.findByRole("complementary", { name: "흠집 목록" });
    expect(await within(list).findByText("출고 검사(2026. 11. 3.)부터 있던 흠집")).toBeInTheDocument();
    expect(within(list).getByText("이번 반납 검사(2026. 11. 9.)에서 새로 발견")).toBeInTheDocument();
    expect(within(list).getByText("새 흠집")).toBeInTheDocument();
    expect(within(list).getByText(/이전 검사부터 있던 흠집 1 · 이번에 새로 발견 1/)).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /찍힘/ }));
    expect(within(list).getByText("처음 발견: 이번 반납 검사(2026. 11. 9.)에서 새로 발견")).toBeInTheDocument();
  });
});

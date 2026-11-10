import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderApp } from "../../test/renderApp";
import { server } from "../../shared/mocks/node";
import { db } from "../../shared/mocks/db";
import type { CatalogDevice, CatalogDiagnostics, CatalogInspectionSummary, CatalogPhotoDefect, ModelDimensions } from "../../shared/api/types";
import { filterRows, mergeCatalog, sortRows } from "./model/catalog";
import { FRAME, faceRatio, laptopPins, placeOnLaptop } from "./model/laptop3d";

const DIMS: ModelDimensions = { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 6 };

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
const summary = (checkpointId: string, defectCount: number, grade: "A" | "B" | "C" | "D"): CatalogInspectionSummary => ({
  checkpointId,
  grade,
  gradedAt: "2026-11-08T10:00:00+09:00",
  defectCount,
  defectsByClass: { scratch: defectCount, dent: 0, crack: 0, stain: 0 },
});
const diag = (checkpointId: string, pct: number, single: number): CatalogDiagnostics => ({
  checkpointId,
  collectedAt: "2026-11-08T10:00:00+09:00",
  os: "MACOS",
  battery: { cycleCount: 100, designCapacity: 100, fullChargeCapacity: pct, capacityUnit: "mAh", maxCapacityPct: pct, condition: "NORMAL", skippedReason: null },
  ssd: null,
  benchmarks: [{ metric: "CPU_SINGLE", median: single }],
});

describe("공개 보유 기기 목록 모델", () => {
  const rows = mergeCatalog(
    [device("a", "Air A", ["ret-a", "out-a"]), device("b", "Air B", ["out-b"], { color: "미드나이트", available: false }), device("c", "Gram C", [])],
    [summary("out-a", 5, "C"), summary("ret-a", 1, "B"), summary("out-b", 0, "A")],
    [diag("out-a", 88, 1500), diag("out-b", 95, 1200)],
  );

  test("기기마다 시점 목록 앞(최근)에서 흠집 요약·진단이 있는 첫 시점을 쓴다", () => {
    expect(rows[0].defectCount).toBe(1); // ret-a가 out-a보다 최근
    expect(rows[0].maxCapacityPct).toBe(88); // 진단은 out-a에만
    expect(rows[2].grade).toBeNull();
  });

  test("흠집 적은 순·배터리 높은 순으로 정렬하고, 값이 없는 기기는 방향과 상관없이 맨 뒤", () => {
    expect(sortRows(rows, "defectCount", "asc").map((r) => r.device.modelName)).toEqual(["Air B", "Air A", "Gram C"]);
    expect(sortRows(rows, "defectCount", "desc").map((r) => r.device.modelName)).toEqual(["Air A", "Air B", "Gram C"]);
    expect(sortRows(rows, "maxCapacityPct", "desc").map((r) => r.device.modelName)).toEqual(["Air B", "Air A", "Gram C"]);
    expect(sortRows(rows, "grade", "asc").map((r) => r.grade)).toEqual(["A", "B", null]);
    expect(sortRows(rows, "CPU_SINGLE", "desc").map((r) => r.bench.CPU_SINGLE)).toEqual([1500, 1200, null]);
  });

  test("검색은 기종·색상·CPU를 띄어쓰기·대소문자 없이 찾고, 대여 가능만 거를 수 있다", () => {
    expect(filterRows(rows, { q: "gram", availableOnly: false }).map((r) => r.device.modelName)).toEqual(["Gram C"]);
    expect(filterRows(rows, { q: "미드 나이트", availableOnly: false }).map((r) => r.device.modelName)).toEqual(["Air B"]);
    expect(filterRows(rows, { q: "apple m2", availableOnly: true }).map((r) => r.device.modelName)).toEqual(["Air A", "Gram C"]);
  });
});

describe("부스 사진 흠집 → 3D 핀", () => {
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

  test("바닥 사진 왼쪽은 사용자 왼쪽, 사진 위쪽은 앞 모서리(앞 모서리를 들어 뒤로 넘겨 찍음)", () => {
    const size = { width: 1, height: 1 };
    const [tl] = FRAME.CAM1;
    const corner = placeOnLaptop("BOT", faceRatio("BOT", "CAM1", tl, size), DIMS);
    expect(corner.position[0]).toBeLessThan(0); // 왼쪽
    expect(corner.position[2]).toBeGreaterThan(0); // 앞
  });

  test("폰 사진은 사진 전체가 면이다", () => {
    expect(faceRatio("TOP", "PHONE", [250, 500], { width: 1000, height: 1000 })).toEqual({ u: 0.25, v: 0.5 });
  });

  test("덮개(윗면) 핀은 덮개 좌표에, 키보드·바닥 핀은 본체 좌표에 놓인다", () => {
    expect(placeOnLaptop("TOP", { u: 0.5, v: 0 }, DIMS)).toEqual({ part: "lid", position: [0, 6, 0], normal: [0, 1, 0] });
    expect(placeOnLaptop("BOT", { u: 0, v: 1 }, DIMS)).toEqual({ part: "base", position: [150, -5, 100], normal: [0, -1, 0] });
    // 옆면 아래쪽(본체)과 위쪽(덮개 모서리)
    expect(placeOnLaptop("SF", { u: 0.5, v: 1 }, DIMS).part).toBe("base");
    expect(placeOnLaptop("SF", { u: 0.5, v: 0 }, DIMS).part).toBe("lid");
  });

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

describe("보유 노트북 화면", () => {
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
  test("등급은 뜻과 함께 읽히고, 검사·진단 기록이 없는 노트북은 빈칸 대신 이유 한 줄을 보인다", async () => {
    const target = db.devices.find((dv) => dv.status !== "RETIRED")!;
    db.rentals = db.rentals.filter((r) => r.deviceId !== target.deviceId);
    renderApp("/devices");
    expect((await screen.findAllByText("아직 부스 검사와 진단 기록이 없습니다")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\((문제 없음|가벼운 긁힘|수리 검토|수리 필요)\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "표 읽는 법" })).toBeInTheDocument();
  });
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

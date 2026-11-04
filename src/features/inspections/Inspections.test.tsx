import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint, Defect, Inspection } from "../../shared/api/types";
import { db } from "../../shared/mocks/db";
import { quickDefect, quickMedia, quickPhotos } from "../../shared/mocks/report";
import { problem } from "../../shared/mocks/handlers/problem";
import { server } from "../../shared/mocks/node";

// 목 데이터: 고객 렌탈 ①(C02PRO0001) 출고·수령 봉인, 반납 촬영됨(결과 없음) / ②(LGGRAM0001) 출고 A / 관리자 렌탈(C02AIR0001) 시점 없음
// / 빠른 검사: C02PRO0001을 다시 빌려준 렌탈, 출고 C(원본 사진 12장)

/** 시리얼 카드. 같은 기기의 렌탈이 여럿이면 contains 글자가 든 카드를 고른다 */
async function card(serial: string, contains?: string) {
  const cards = await screen.findAllByRole("listitem", { name: serial });
  const hit = contains ? cards.find((c) => c.textContent?.includes(contains)) : cards[0];
  if (!hit) throw new Error(`카드 없음: ${serial} ${contains ?? ""}`);
  return hit;
}

function defect(face: Defect["face"], cls: Defect["class"], confidence: number, lengthMm: number | null): Defect {
  return {
    defectId: nanoid(),
    face,
    class: cls,
    polygon: [
      [10, 10],
      [40, 10],
      [40, 20],
      [10, 20],
    ],
    lengthMm,
    areaMm2: lengthMm === null ? null : 3.1,
    confidence,
    modelVersion: "yolo11s-seg-v001",
    source: "AUTO",
    match: null,
  };
}

/** 사용 가능 기기 하나로 시점이 하나 있는 렌탈을 넣고, 원하면 그 시점의 검사 결과도 넣는다 */
function addRental(serial: string, status: Checkpoint["status"], inspection?: Omit<Inspection, "checkpointId">) {
  const device = db.devices.find((d) => d.serial === serial);
  const rentalId = nanoid();
  const checkpointId = nanoid();
  const now = new Date().toISOString();
  db.rentals.push({
    rentalId,
    deviceId: device?.deviceId ?? "",
    renterRef: "R-4001",
    status: "OPEN",
    startedAt: now,
    endedAt: null,
    createdAt: now,
    checkpoints: [{ checkpointId, type: "OUT", status, occurredAt: now }],
  });
  if (inspection) db.report.inspections.set(checkpointId, { checkpointId, ...inspection });
  return { rentalId, checkpointId };
}

test("검사 결과 목록은 렌탈마다 지금 시점과 판정을 보인다: 결과 없음은 판정 대기, A는 문제 없음, 시점 없음은 검사 전", async () => {
  renderAsAdmin("/admin/inspections");
  expect(await screen.findByRole("link", { name: "검사 결과" })).toBeInTheDocument();
  const returned = await card("C02PRO0001", "반납");
  expect(within(returned).getByText("반납 · 촬영됨")).toBeInTheDocument();
  expect(await within(returned).findByText("판정 대기")).toBeInTheDocument();
  expect(within(returned).getByRole("link", { name: "결과 보기" })).toBeInTheDocument();
  expect(await within(await card("LGGRAM0001")).findByText("문제 없음")).toBeInTheDocument();
  const none = await card("C02AIR0001");
  expect(within(none).getByText("검사 전")).toBeInTheDocument();
  expect(within(none).queryByRole("link", { name: "결과 보기" })).not.toBeInTheDocument();
  expect(within(none).getByRole("link", { name: "렌탈 열기" })).toBeInTheDocument();
  const quick = await card("C02PRO0001", "출고 · 등급 매김");
  expect(await within(quick).findByText("문제 있음 · C등급")).toBeInTheDocument();
});

test("등급 B~D면 목록에 문제 있음과 등급이 보이고, 결과 보기를 누르면 판정·근거·흠집 카드가 보인다", async () => {
  addRental("C02AIR0002", "GRADED", {
    grade: "C",
    ruleVersion: "grade-rules-v1",
    reasons: ["찍힘·긁힘 5개 이상"],
    defects: [defect("TOP", "scratch", 0.914, 12.04), defect("BOT", "dent", 0.6, null)],
  });
  const user = userEvent.setup();
  renderAsAdmin("/admin/inspections");
  const bad = await card("C02AIR0002");
  expect(await within(bad).findByText("문제 있음 · C등급")).toBeInTheDocument();
  await user.click(within(bad).getByRole("link", { name: "결과 보기" }));
  expect(await screen.findByRole("heading", { name: "C02AIR0002 출고 검사 결과" })).toBeInTheDocument();
  const verdict = screen.getByRole("status", { name: "판정" });
  expect(verdict).toHaveTextContent("문제 있음 · C등급");
  expect(verdict).toHaveTextContent("찍힘·긁힘 5개 이상");
  expect(screen.getAllByText(/grade-rules-v1/).length).toBeGreaterThan(0);
  expect(within(screen.getByRole("status", { name: "수리 필요 여부" })).getByText(/수리 필요/, { selector: ".verdict-title" })).toHaveTextContent(
    /^✖ 수리 필요$/,
  );
  expect(screen.getByRole("heading", { name: "문제 항목 요약 · 흠집 2개" })).toBeInTheDocument();
  const first = screen.getByRole("listitem", { name: "흠집 1" });
  expect(first).toHaveTextContent("긁힘");
  expect(first).toHaveTextContent("윗면(덮개)");
  expect(first).toHaveTextContent("신뢰도 91%");
  expect(first).toHaveTextContent("길이 12.0 mm");
  expect(screen.getByRole("listitem", { name: "흠집 2" })).toHaveTextContent("길이 —");
  expect(await screen.findByText("사진이 아직 없습니다.")).toBeInTheDocument();
});

test("A 등급 시점의 상세는 문제 없음과 흠집이 없다는 문장을 보인다", async () => {
  const rental = db.rentals.find((r) => db.devices.find((d) => d.deviceId === r.deviceId)?.serial === "LGGRAM0001");
  const out = rental?.checkpoints[0];
  renderAsAdmin(`/admin/inspections/${rental?.rentalId}/${out?.checkpointId}`);
  expect(await screen.findByRole("heading", { name: "LGGRAM0001 출고 검사 결과" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "판정" })).toHaveTextContent("문제 없음");
  expect(screen.getByText(/발견된 문제 없음/)).toBeInTheDocument();
  expect(within(screen.getByRole("status", { name: "수리 필요 여부" })).getByText(/수리 필요/, { selector: ".verdict-title" })).toHaveTextContent(
    /^✔ 수리 필요 없음$/,
  );
  // 정합 세트라 면 사진(부스 8면)을 보인다
  expect(within(await screen.findByRole("list", { name: "면 사진" })).getAllByRole("listitem")).toHaveLength(8);
});

/** 사진이 로드된 것처럼 natural 크기를 넣고 load 이벤트를 낸다(jsdom은 이미지를 읽지 않는다) */
function loadImage(img: HTMLElement, width = 1600, height = 1200) {
  Object.defineProperty(img, "naturalWidth", { value: width });
  Object.defineProperty(img, "naturalHeight", { value: height });
  fireEvent.load(img);
}

test("빠른 검사(QUICK) 시점의 상세는 면마다 카메라 2 × 조명 3 사진 격자를 보이고, 사진이 로드되면 그 사진의 흠집 폴리곤을 겹친다", async () => {
  const { rentalId, checkpointId } = addRental("C02AIR0002", "GRADED", {
    grade: "C",
    ruleVersion: "grade-rules-v1",
    reasons: ["긁힘 1개·찍힘 1개"],
    defects: [],
    photoDefects: [
      quickDefect("TOP", "L1", "CAM1", "scratch", 600, 400, 0.91),
      quickDefect("TOP", "L2", "CAM1", "scratch", 604, 402, 0.87),
      quickDefect("BOT", "L3", "CAM2", "dent", 900, 700, 0.78),
    ],
  });
  db.report.media.set(checkpointId, quickMedia(checkpointId));
  renderAsAdmin(`/admin/inspections/${rentalId}/${checkpointId}`);
  expect(await screen.findByRole("heading", { name: "문제 항목 요약 · 흠집 3개" })).toBeInTheDocument();
  const first = screen.getByRole("listitem", { name: "흠집 1" });
  expect(first).toHaveTextContent("긁힘");
  expect(first).toHaveTextContent("CAM1 앞 반 · L1 확산");
  expect(first).not.toHaveTextContent("길이");
  const top = await screen.findByRole("region", { name: "윗면(덮개) 사진" });
  expect(within(top).getByRole("heading", { name: "윗면(덮개) · 흠집 2개" })).toBeInTheDocument();
  expect(within(top).getAllByRole("listitem")).toHaveLength(6);
  const cell = within(top).getByRole("listitem", { name: "윗면(덮개) CAM1 L1" });
  expect(cell).toHaveTextContent("CAM1 앞 반 · L1 확산 · 흠집 1개");
  expect(within(cell).queryByRole("img", { name: "흠집 1개 표시" })).not.toBeInTheDocument();
  loadImage(within(cell).getByRole("img", { name: "윗면(덮개) CAM1 L1 사진" }));
  const overlay = within(cell).getByRole("img", { name: "흠집 1개 표시" });
  expect(overlay).toHaveAttribute("viewBox", "0 0 1600 1200");
  const polygons = overlay.querySelectorAll("polygon");
  expect(polygons).toHaveLength(1);
  expect(polygons[0].getAttribute("points")).toBe("540,392 660,396 660,408 540,404");
  // 흠집 없는 사진에는 겹치는 그림이 없다
  const clean = within(top).getByRole("listitem", { name: "윗면(덮개) CAM2 L1" });
  loadImage(within(clean).getByRole("img", { name: "윗면(덮개) CAM2 L1 사진" }));
  expect(within(clean).queryByRole("img", { name: /표시/ })).not.toBeInTheDocument();
  expect(clean).toHaveTextContent("흠집 0개");
  expect(screen.getByRole("region", { name: "바닥 사진" })).toHaveTextContent("바닥 · 흠집 1개");
});

test("사진을 읽다 오류가 나도 판정은 보이고, 사진 자리에 오류와 다시 시도가 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/media", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  const rental = db.rentals.find((r) => db.devices.find((d) => d.deviceId === r.deviceId)?.serial === "LGGRAM0001");
  renderAsAdmin(`/admin/inspections/${rental?.rentalId}/${rental?.checkpoints[0]?.checkpointId}`);
  expect(await screen.findByRole("status", { name: "판정" })).toHaveTextContent("문제 없음");
  expect(await screen.findByRole("alert")).toHaveTextContent("사진을 불러오지 못했습니다.");
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});

test("검사 결과가 아직 없는 시점의 상세는 판정 대기 안내를 보이고 오류로 보이지 않는다", async () => {
  const rental = db.rentals.find((r) => r.checkpoints.length === 3);
  const ret = rental?.checkpoints[2];
  renderAsAdmin(`/admin/inspections/${rental?.rentalId}/${ret?.checkpointId}`);
  expect(await screen.findByRole("heading", { name: "C02PRO0001 반납 검사 결과" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "판정" })).toHaveTextContent("판정 대기");
  expect(screen.getByText(/등급이 매겨지면 여기에 보입니다/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("검사 결과를 읽다 서버 오류가 나면 오류 문장과 다시 시도가 보이고, 목록 카드에는 읽지 못했다고 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  const { rentalId, checkpointId } = addRental("C02AIR0002", "GRADED");
  renderAsAdmin(`/admin/inspections/${rentalId}/${checkpointId}`);
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 뒤 다시 시도해 주세요.");
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});

test("목록 카드의 판정을 읽지 못하면 그 카드에만 읽지 못했다고 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  renderAsAdmin("/admin/inspections");
  expect(await within(await card("LGGRAM0001")).findByText("판정을 읽지 못함")).toBeInTheDocument();
  expect(within(await card("C02AIR0001")).getByText("검사 전")).toBeInTheDocument();
});

test("렌탈이 20건 넘으면 더 보기로 다음 쪽을 이어 붙인다", async () => {
  for (let i = 0; i < 20; i += 1) addRental("C02AIR0003", "OPEN");
  const user = userEvent.setup();
  renderAsAdmin("/admin/inspections");
  const more = await screen.findByRole("button", { name: "더 보기" });
  expect(screen.getAllByRole("listitem", { name: "C02AIR0003" })).toHaveLength(20);
  await user.click(more);
  await waitFor(() => expect(screen.getByRole("listitem", { name: "C02AIR0001" })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
});

test("주소의 시점이 그 렌탈에 없으면 검사 결과를 읽지 않고 검사 전으로 보인다(다른 렌탈의 결과가 섞이지 않음)", async () => {
  // 검사 결과를 읽으면 500이 나게 두어, 읽지 않았음을 오류 없음으로 확인한다
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  const none = db.rentals.find((r) => r.checkpoints.length === 0);
  const graded = db.rentals.find((r) => r.checkpoints.length === 1);
  const other = graded?.checkpoints[0]?.checkpointId;
  const { client } = renderAsAdmin(`/admin/inspections/${none?.rentalId}/${other}`);
  expect(await screen.findByRole("heading", { name: "C02AIR0001 검사 결과" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "판정" })).toHaveTextContent("검사 전");
  // 다른 렌탈의 시점으로 검사 결과 쿼리를 만들지 않았다
  expect(client.getQueryCache().find({ queryKey: ["inspections", other] })).toBeUndefined();
  expect(screen.getByText("이 렌탈에 그런 시점이 없습니다.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /흠집/ })).not.toBeInTheDocument();
});

test("새로 고침을 누르면 목록을 다시 읽어 부스가 시작한 시점과 그 판정이 보인다", async () => {
  const device = db.devices.find((d) => d.serial === "LGGRAM0002");
  const now = new Date().toISOString();
  const rental = {
    rentalId: nanoid(),
    deviceId: device?.deviceId ?? "",
    renterRef: "R-4002",
    status: "OPEN" as const,
    startedAt: now,
    endedAt: null,
    createdAt: now,
    checkpoints: [] as Checkpoint[],
  };
  db.rentals.push(rental);
  const user = userEvent.setup();
  renderAsAdmin("/admin/inspections");
  expect(within(await card("LGGRAM0002")).getByText("검사 전")).toBeInTheDocument();
  // 부스가 출고 시점을 시작하고 등급이 매겨진 뒤
  const checkpointId = nanoid();
  rental.checkpoints.push({ checkpointId, type: "OUT", status: "GRADED", occurredAt: now });
  db.report.inspections.set(checkpointId, { checkpointId, grade: "A", ruleVersion: "grade-rules-v1", reasons: ["흠집 없음"], defects: [] });
  await user.click(screen.getByRole("button", { name: "새로 고침" }));
  expect(await within(await card("LGGRAM0002")).findByText("문제 없음")).toBeInTheDocument();
  expect(within(await card("LGGRAM0002")).getByRole("link", { name: "결과 보기" })).toBeInTheDocument();
});

test("정합 세트(FULL)의 사진 응답에 원본 사진이 함께 와도 면 사진 위의 표준 좌표 흠집을 보인다", async () => {
  const rental = db.rentals.find((r) => db.devices.find((d) => d.deviceId === r.deviceId)?.serial === "LGGRAM0001");
  const out = rental?.checkpoints[0];
  const media = db.report.media.get(out?.checkpointId ?? "");
  if (media) media.photos = quickPhotos();
  renderAsAdmin(`/admin/inspections/${rental?.rentalId}/${out?.checkpointId}`);
  expect(within(await screen.findByRole("list", { name: "면 사진" })).getAllByRole("listitem")).toHaveLength(8);
  expect(screen.queryByRole("region", { name: /사진$/ })).not.toBeInTheDocument();
});

test("사진 주소를 못 읽으면 그 칸에만 안내와 다시 시도가 보이고, 다시 시도하면 사진을 다시 읽는다", async () => {
  const { rentalId, checkpointId } = addRental("C02AIR0002", "GRADED", {
    grade: "C",
    ruleVersion: "grade-rules-v1",
    reasons: ["긁힘 1개"],
    defects: [],
    photoDefects: [quickDefect("TOP", "L1", "CAM1", "scratch", 600, 400, 0.91)],
  });
  db.report.media.set(checkpointId, quickMedia(checkpointId));
  const user = userEvent.setup();
  renderAsAdmin(`/admin/inspections/${rentalId}/${checkpointId}`);
  const top = await screen.findByRole("region", { name: "윗면(덮개) 사진" });
  const cell = within(top).getByRole("listitem", { name: "윗면(덮개) CAM1 L1" });
  fireEvent.error(within(cell).getByRole("img", { name: "윗면(덮개) CAM1 L1 사진" }));
  expect(cell).toHaveTextContent("사진을 불러오지 못함");
  expect(within(top).getByRole("listitem", { name: "윗면(덮개) CAM2 L1" })).not.toHaveTextContent("사진을 불러오지 못함");
  await user.click(within(cell).getByRole("button", { name: "다시 시도" }));
  expect(within(cell).getByRole("img", { name: "윗면(덮개) CAM1 L1 사진" })).toBeInTheDocument();
  expect(cell).not.toHaveTextContent("사진을 불러오지 못함");
});

test("빠른 검사 사진을 누르면 크게 보기 팝업이 열리고, 이전·다음으로 12장을 넘기고 닫으면 사라진다", async () => {
  const { rentalId, checkpointId } = addRental("C02AIR0002", "GRADED", {
    grade: "C",
    ruleVersion: "grade-rules-v1",
    reasons: ["긁힘 1개"],
    defects: [],
    photoDefects: [quickDefect("TOP", "L1", "CAM1", "scratch", 600, 400, 0.91)],
  });
  db.report.media.set(checkpointId, quickMedia(checkpointId));
  const user = userEvent.setup();
  renderAsAdmin(`/admin/inspections/${rentalId}/${checkpointId}`);
  const top = await screen.findByRole("region", { name: "윗면(덮개) 사진" });
  await user.click(within(top).getByRole("button", { name: "윗면(덮개) CAM1 L1 사진 크게 보기" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAccessibleName("사진 크게 보기: 윗면(덮개) · CAM1 앞 반 · L1 확산");
  expect(dialog).toHaveTextContent("1 / 12");
  expect(within(dialog).getByRole("button", { name: "← 이전 사진" })).toBeDisabled();
  // 열린 동안 Tab은 팝업 안에서만 돈다: 마지막(다음 사진)에서 Tab은 처음(닫기)으로, 처음에서 Shift+Tab은 마지막으로
  const close = within(dialog).getByRole("button", { name: "닫기" });
  const next = within(dialog).getByRole("button", { name: "다음 사진 →" });
  expect(close).toHaveFocus();
  next.focus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(next).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "다음 사진 →" }));
  expect(screen.getByRole("dialog")).toHaveAccessibleName("사진 크게 보기: 윗면(덮개) · CAM1 앞 반 · L2 왼쪽 스침광");
  expect(screen.getByRole("dialog")).toHaveTextContent("2 / 12");
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("dialog")).toHaveTextContent("1 / 12");
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("렌탈 상세의 검사 이력에서 상세보기를 누르면 그 검사 결과가 열리고, 렌탈 상세로 돌아갈 수 있다", async () => {
  const { rentalId } = addRental("C02AIR0002", "GRADED", { grade: "B", ruleVersion: "grade-rules-v1", reasons: ["긁힘 1개"], defects: [] });
  const user = userEvent.setup();
  const { router } = renderAsAdmin(`/admin/rentals/${rentalId}`);
  const history = await screen.findByRole("list", { name: "검사 이력" });
  const row = within(history).getByRole("listitem", { name: "출고 검사" });
  expect(await within(row).findByText("문제 있음 · B등급")).toBeInTheDocument();
  expect(within(row).getByText("수리 필요")).toBeInTheDocument();
  await user.click(within(row).getByRole("link", { name: "상세보기" }));
  expect(await screen.findByRole("heading", { name: "C02AIR0002 출고 검사 결과" })).toBeInTheDocument();
  // B 등급인데 흠집 위치 기록이 비었으면 "문제 없음"이라고 하지 않는다
  expect(await screen.findByText(/등록된 흠집 위치 없음/)).toBeInTheDocument();
  expect(screen.queryByText(/발견된 문제 없음/)).not.toBeInTheDocument();
  await user.click(screen.getAllByRole("link", { name: "← 렌탈 상세로" })[0]);
  await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/rentals/${rentalId}`));
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint, Defect, Inspection } from "../../shared/api/types";
import { db } from "../../shared/mocks/db";
import { problem } from "../../shared/mocks/handlers/problem";
import { server } from "../../shared/mocks/node";

// 목 데이터: 고객 렌탈 ①(C02PRO0001) 출고·수령 봉인, 반납 촬영됨(결과 없음) / ②(LGGRAM0001) 출고 A / 관리자 렌탈(C02AIR0001) 시점 없음

const card = (serial: string) => screen.findByRole("listitem", { name: serial });

function defect(face: Defect["face"], cls: Defect["class"], confidence: number, lengthMm: number | null): Defect {
  return {
    defectId: nanoid(),
    face,
    class: cls,
    polygon: [[10, 10], [40, 10], [40, 20], [10, 20]],
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
  const returned = await card("C02PRO0001");
  expect(within(returned).getByText("반납 · 촬영됨")).toBeInTheDocument();
  expect(await within(returned).findByText("판정 대기")).toBeInTheDocument();
  expect(within(returned).getByRole("link", { name: "결과 보기" })).toBeInTheDocument();
  expect(await within(await card("LGGRAM0001")).findByText("문제 없음")).toBeInTheDocument();
  const none = await card("C02AIR0001");
  expect(within(none).getByText("검사 전")).toBeInTheDocument();
  expect(within(none).queryByRole("link", { name: "결과 보기" })).not.toBeInTheDocument();
  expect(within(none).getByRole("link", { name: "렌탈 열기" })).toBeInTheDocument();
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
  expect(screen.getByText(/판정 규칙 grade-rules-v1/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "흠집 2개" })).toBeInTheDocument();
  const first = screen.getByRole("listitem", { name: "흠집 1" });
  expect(first).toHaveTextContent("긁힘");
  expect(first).toHaveTextContent("윗면(덮개)");
  expect(first).toHaveTextContent("신뢰도 91%");
  expect(first).toHaveTextContent("길이 12.0 mm");
  expect(screen.getByRole("listitem", { name: "흠집 2" })).toHaveTextContent("길이 —");
  expect(screen.getByRole("note")).toHaveTextContent("사진과 흠집 위치 겹쳐 보기는 계약 반영 뒤");
});

test("A 등급 시점의 상세는 문제 없음과 흠집이 없다는 문장을 보인다", async () => {
  const rental = db.rentals.find((r) => db.devices.find((d) => d.deviceId === r.deviceId)?.serial === "LGGRAM0001");
  const out = rental?.checkpoints[0];
  renderAsAdmin(`/admin/inspections/${rental?.rentalId}/${out?.checkpointId}`);
  expect(await screen.findByRole("heading", { name: "LGGRAM0001 출고 검사 결과" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "판정" })).toHaveTextContent("문제 없음");
  expect(screen.getByText("흠집이 없습니다.")).toBeInTheDocument();
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

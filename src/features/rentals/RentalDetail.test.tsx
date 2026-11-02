import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import { db, sealLastCheckpoint } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";

const user = () => userEvent.setup();
const step = (name: string) => screen.getByRole("listitem", { name });

/** 사용 가능 기기(C02AIR0002)에 시점 없는 새 렌탈을 넣고 상세를 연다 */
async function openNewRental() {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const now = new Date().toISOString();
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-2001", status: "OPEN", startedAt: null, endedAt: null, createdAt: now, checkpoints: [] });
  const u = user();
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  await screen.findByRole("listitem", { name: "출고" });
  return { u, rentalId };
}

test("시점이 없는 렌탈 상세는 대여자 참조 번호를 보이고 출고 시작 버튼만 누를 수 있다", async () => {
  await openNewRental();
  expect(within(step("출고")).getByRole("button", { name: "출고 시작" })).toBeEnabled();
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
  expect(within(step("반납")).getByRole("button", { name: "반납 시작" })).toBeDisabled();
  expect(screen.getByText(/대여자 참조 번호 R-2001/)).toBeInTheDocument();
});

test("출고 시점이 없는 렌탈에서 수령·반납 시작은 누를 수 없고 왜 안 되는지(출고 먼저) 보인다", async () => {
  await openNewRental();
  expect(within(step("수령")).getByText("출고를 먼저 시작하세요")).toBeInTheDocument();
  expect(within(step("반납")).getByText("수령을 먼저 시작하세요")).toBeInTheDocument();
});

test("순서가 어긋난 요청에 서버가 409(순서 위반)를 주면 문장이 보이고 렌탈 상세를 다시 읽어 최신 상태를 보인다", async () => {
  const { u, rentalId } = await openNewRental();
  // 다른 화면에서 이미 출고를 시작한 상태
  db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.push({ checkpointId: "other-tab-out", type: "OUT", status: "OPEN", occurredAt: null });
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("시점은 출고 → 수령 → 반납 순서로만 시작할 수 있습니다");
  await waitFor(() => expect(within(step("출고")).getByText("촬영 대기")).toBeInTheDocument());
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
});

test("출고 기록이 봉인되기 전에는 수령 시작을 누를 수 없고, 봉인되면 누를 수 있다", async () => {
  const { u, rentalId } = await openNewRental();
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  expect(await within(step("수령")).findByText("출고 기록이 봉인되면 시작할 수 있습니다")).toBeInTheDocument();
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
  sealLastCheckpoint(rentalId);
  await u.click(screen.getByRole("button", { name: "새로 고침" }));
  await waitFor(() => expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeEnabled());
});

/** 출고·수령은 시작 뒤 봉인까지 시키고, 반납은 시작만 한다 */
async function goThroughReturn(u: ReturnType<typeof user>, rentalId: string) {
  for (const name of ["출고 시작", "수령 시작", "반납 시작"]) {
    await waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
    await u.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(screen.queryByRole("button", { name })).not.toBeInTheDocument());
    if (name === "반납 시작") return;
    sealLastCheckpoint(rentalId);
    await u.click(screen.getByRole("button", { name: "새로 고침" }));
  }
}

test("반납 시점이 열렸지만 아직 봉인되지 않은 렌탈은 종료 버튼이 꺼져 있고 봉인 안내와 지금 시점 상태가 보인다", async () => {
  const { u, rentalId } = await openNewRental();
  await goThroughReturn(u, rentalId);
  expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("반납 기록이 봉인되면 종료할 수 있습니다. 지금 반납 시점: 촬영 대기");
});

test("반납 시점이 봉인된 렌탈에서 렌탈 종료를 누르면 확인 창 뒤 렌탈이 종료 상태로 보인다", async () => {
  const { u, rentalId } = await openNewRental();
  await goThroughReturn(u, rentalId);
  sealLastCheckpoint(rentalId);
  await u.click(screen.getByRole("button", { name: "새로 고침" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeEnabled());
  await u.click(screen.getByRole("button", { name: "렌탈 종료" }));
  await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "렌탈 종료" }));
  expect(await screen.findByText("종료된 렌탈입니다.")).toBeInTheDocument();
  expect(db.rentals.find((r) => r.rentalId === rentalId)?.status).toBe("CLOSED");
});

test("화면은 종료할 수 있다고 봤지만 서버가 종료를 409로 거절하면 서버 문장이 보이고 상세를 다시 읽는다", async () => {
  const { u, rentalId } = await openNewRental();
  await goThroughReturn(u, rentalId);
  sealLastCheckpoint(rentalId);
  await u.click(screen.getByRole("button", { name: "새로 고침" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeEnabled());
  server.use(http.post("*/api/v1/rentals/:rentalId/close", () => problem(409, "RENTAL_NOT_CLOSABLE", "아직 종료할 수 없습니다")));
  const ret = db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.at(-1);
  if (ret) ret.status = "GRADED";
  await u.click(screen.getByRole("button", { name: "렌탈 종료" }));
  await u.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "렌탈 종료" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("반납 기록이 봉인되기 전에는 종료할 수 없습니다.");
  await waitFor(() => expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeDisabled());
});

test("상세를 받은 뒤 다시 읽기가 실패해도 시점 단계는 그대로 보이고 오류 문장과 다시 시도가 보인다", async () => {
  const { u } = await openNewRental();
  server.use(http.get("*/api/v1/rentals/:rentalId", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  await u.click(screen.getByRole("button", { name: "새로 고침" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 뒤 다시 시도해 주세요.");
  expect(step("출고")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});

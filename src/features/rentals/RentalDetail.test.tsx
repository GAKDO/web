// 이 파일이 확인하는 것: 관리자의 렌탈 상세 화면. 시점은 출고 → 수령 → 반납 순서로만 시작하고, 앞 시점이 봉인돼야 다음을 시작한다.
// 반납이 봉인돼야 렌탈을 종료할 수 있다. 부스에 넣을 ID 복사와 6자리 부스 코드 발급도 이 화면에서 한다.

import { vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import { db, sealLastCheckpoint } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";

// 테스트 도구: 클릭·입력을 흉내 내는 도구 만들기.
const user = () => userEvent.setup();
// 테스트 도구: 시점 칸(출고·수령·반납)을 이름으로 찾는다.
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

// [상황] 아직 시점이 하나도 없는 새 렌탈의 상세를 연다.
// [기대] 대여자 참조 번호가 보이고, "출고 시작"만 누를 수 있으며 수령·반납 시작은 막혀 있다.
test("시점이 없는 렌탈 상세는 대여자 참조 번호를 보이고 출고 시작 버튼만 누를 수 있다", async () => {
  await openNewRental();
  expect(within(step("출고")).getByRole("button", { name: "출고 시작" })).toBeEnabled();
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
  expect(within(step("반납")).getByRole("button", { name: "반납 시작" })).toBeDisabled();
  expect(screen.getByText(/대여자 참조 번호 R-2001/)).toBeInTheDocument();
});

// [상황] 출고를 시작하지 않은 렌탈의 수령·반납 칸을 본다.
// [기대] 각각 "출고를 먼저 시작하세요", "수령을 먼저 시작하세요"로 안 되는 이유가 보인다.
test("출고 시점이 없는 렌탈에서 수령·반납 시작은 누를 수 없고 왜 안 되는지(출고 먼저) 보인다", async () => {
  await openNewRental();
  expect(within(step("수령")).getByText("출고를 먼저 시작하세요")).toBeInTheDocument();
  expect(within(step("반납")).getByText("수령을 먼저 시작하세요")).toBeInTheDocument();
});

// [상황] 다른 탭에서 이미 출고를 시작했는데, 이 화면에서 "출고 시작"을 또 누른다.
// [기대] 서버의 순서 위반(409)이 "시점은 출고 → 수령 → 반납 순서로만 시작할 수 있습니다"로 보이고,
//        상세를 다시 읽어 출고가 "촬영 대기"인 최신 상태를 보인다.
test("순서가 어긋난 요청에 서버가 409(순서 위반)를 주면 문장이 보이고 렌탈 상세를 다시 읽어 최신 상태를 보인다", async () => {
  const { u, rentalId } = await openNewRental();
  // 다른 화면에서 이미 출고를 시작한 상태
  db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.push({ checkpointId: "other-tab-out", type: "OUT", status: "OPEN", occurredAt: null });
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("시점은 출고 → 수령 → 반납 순서로만 시작할 수 있습니다");
  await waitFor(() => expect(within(step("출고")).getByText("촬영 대기")).toBeInTheDocument());
  expect(within(step("수령")).getByRole("button", { name: "수령 시작" })).toBeDisabled();
});

// [상황] 출고를 시작한 뒤, 출고가 봉인되고 "새로 고침"을 누른다.
// [기대] 봉인 전엔 "출고 기록이 봉인되면 시작할 수 있습니다"와 함께 수령 시작이 막혀 있고, 봉인되면 누를 수 있다.
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

// [상황] 출고·수령을 봉인까지 마치고 반납을 시작만 했다.
// [기대] "렌탈 종료"가 꺼져 있고, "반납 기록이 봉인되면 종료할 수 있습니다. 지금 반납 시점: 촬영 대기"가 보인다.
test("반납 시점이 열렸지만 아직 봉인되지 않은 렌탈은 종료 버튼이 꺼져 있고 봉인 안내와 지금 시점 상태가 보인다", async () => {
  const { u, rentalId } = await openNewRental();
  await goThroughReturn(u, rentalId);
  expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("반납 기록이 봉인되면 종료할 수 있습니다. 지금 반납 시점: 촬영 대기");
});

// [상황] 반납까지 봉인된 렌탈에서 "렌탈 종료"를 누르고 확인 창에서 다시 누른다.
// [기대] "종료된 렌탈입니다."가 보이고 렌탈이 종료(CLOSED) 상태가 된다.
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

// [상황] 화면은 봉인된 것으로 봤지만 그사이 반납이 봉인 전 상태로 바뀌었고, 서버가 종료를 409로 거절한다.
// [기대] "반납 기록이 봉인되기 전에는 종료할 수 없습니다."가 보이고, 상세를 다시 읽어 종료 버튼이 꺼진다.
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

// [상황] 상세를 한 번 받은 뒤 "새로 고침"이 서버 오류(500)로 실패한다.
// [기대] "잠시 뒤 다시 시도해 주세요."와 "다시 시도"가 보이고, 이미 보던 시점 단계는 사라지지 않는다.
test("상세를 받은 뒤 다시 읽기가 실패해도 시점 단계는 그대로 보이고 오류 문장과 다시 시도가 보인다", async () => {
  const { u } = await openNewRental();
  server.use(http.get("*/api/v1/rentals/:rentalId", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  await u.click(screen.getByRole("button", { name: "새로 고침" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 뒤 다시 시도해 주세요.");
  expect(step("출고")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});

// [상황] 새 렌탈의 "부스에 넣을 ID" 칸을 보고, 출고를 시작한 뒤 "출고 시점 ID 복사"를 누른다.
// [기대] 렌탈 ID·기기 ID가 보이고 출고 시점 ID는 "출고 시작을 누르면 생깁니다"였다가, 시작하면 나타난다.
//        복사하면 그 ID가 복사되고 버튼이 "복사됨"이 되며, 화면 낭독기에도 복사했다고 알린다.
test("렌탈 상세의 '부스에 넣을 ID'에 기기·렌탈 ID가 보이고, 출고를 시작하면 출고 시점 ID가 생기며 복사 버튼으로 복사된다", async () => {
  const { u, rentalId } = await openNewRental();
  const panel = screen.getByRole("region", { name: "부스에 넣을 ID" });
  const rental = db.rentals.find((r) => r.rentalId === rentalId);
  expect(within(panel).getByText(rentalId)).toBeInTheDocument();
  expect(within(panel).getByText(rental?.deviceId ?? "?")).toBeInTheDocument();
  expect(within(panel).getByText(/출고 시작을 누르면 생깁니다/)).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  const checkpointId = await waitFor(() => {
    const id = db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints[0]?.checkpointId;
    if (!id) throw new Error("아직 시점 없음");
    return id;
  });
  expect(await within(panel).findByText(checkpointId)).toBeInTheDocument();
  const write = vi.spyOn(navigator.clipboard, "writeText");
  await u.click(within(panel).getByRole("button", { name: "출고 시점 ID 복사" }));
  expect(write).toHaveBeenCalledWith(checkpointId);
  expect(within(panel).getByRole("button", { name: "출고 시점 ID 복사" })).toHaveTextContent("복사됨");
  expect(within(panel).getByText("출고 시점 ID를 복사했습니다")).toHaveAttribute("aria-live", "polite");
});

// [상황] 브라우저가 복사를 막은 상태에서 "렌탈 ID 복사"를 누른다.
// [기대] "복사됨" 대신 "직접 복사하세요" 경고가 보이고 버튼 글자는 "복사" 그대로다.
test("클립보드를 쓸 수 없으면 '부스에 넣을 ID' 복사는 복사됨 대신 직접 복사하라고 알린다", async () => {
  const { u } = await openNewRental();
  const panel = screen.getByRole("region", { name: "부스에 넣을 ID" });
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
  await u.click(within(panel).getByRole("button", { name: "렌탈 ID 복사" }));
  expect(await within(panel).findByRole("alert")).toHaveTextContent("직접 복사하세요");
  expect(within(panel).getByRole("button", { name: "렌탈 ID 복사" })).toHaveTextContent("복사");
});

// [상황] 출고 시작 전에 부스 코드 칸을 보고, 출고를 시작한 뒤 "부스 코드 발급"을 누른다.
// [기대] 시작 전엔 발급 버튼이 없다. 시작 뒤 발급하면 6자리 숫자와 "출고 촬영용 · 한 번만 쓸 수 있어요 · 남은 시간"이 보이고, 다시 발급 버튼이 생긴다.
test("출고를 시작하기 전에는 부스 코드 발급이 없고, 시작하면 발급한 6자리와 남은 시간이 보인다", async () => {
  const { u } = await openNewRental();
  const panel = screen.getByRole("region", { name: "부스에 넣을 ID" });
  expect(within(panel).queryByRole("button", { name: "부스 코드 발급" })).not.toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  await u.click(await within(panel).findByRole("button", { name: "부스 코드 발급" }));
  const box = within(panel).getByRole("group", { name: "부스 코드" });
  expect(await within(box).findByLabelText("부스 코드 6자리")).toHaveTextContent(/^\d{6}$/);
  expect(within(box).getByText(/출고 촬영용 · 한 번만 쓸 수 있어요 · 남은 시간 \d+분 \d+초/)).toBeInTheDocument();
  expect(within(box).getByRole("button", { name: "부스 코드 다시 발급" })).toBeInTheDocument();
});

// [상황] 출고 촬영이 이미 끝난(촬영됨) 렌탈을 연다.
// [기대] 부스 코드 칸이 없다(다시 찍지 않게).
test("출고를 찍은 뒤(촬영됨)에는 부스 코드를 발급할 수 없다", async () => {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const now = new Date().toISOString();
  db.rentals.push({
    rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-2002", status: "OPEN", startedAt: now, endedAt: null, createdAt: now,
    checkpoints: [{ checkpointId: nanoid(), type: "OUT", status: "CAPTURED", occurredAt: now }],
  });
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  const panel = await screen.findByRole("region", { name: "부스에 넣을 ID" });
  expect(within(panel).queryByRole("group", { name: "부스 코드" })).not.toBeInTheDocument();
});

// [상황] 부스 코드 발급을 서버가 409로 거절하며 "출고 시점을 먼저 시작하세요."라는 이유를 준다.
// [기대] 서버가 준 이유 문장이 그대로 보인다.
test("부스 코드 발급이 거절되면 서버가 알려 준 이유를 보인다", async () => {
  const { u } = await openNewRental();
  await u.click(screen.getByRole("button", { name: "출고 시작" }));
  server.use(http.post("*/api/v1/rentals/:rentalId/booth-code", () => problem(409, "CHECKPOINT_ORDER_VIOLATION", "시점 순서가 맞지 않습니다", "출고 시점을 먼저 시작하세요.")));
  const panel = screen.getByRole("region", { name: "부스에 넣을 ID" });
  await u.click(await within(panel).findByRole("button", { name: "부스 코드 발급" }));
  expect(await within(panel).findByRole("alert")).toHaveTextContent("출고 시점을 먼저 시작하세요.");
});

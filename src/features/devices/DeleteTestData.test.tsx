import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { renderAsAdmin } from "../../test/renderApp";
import { db, mockDevice } from "../../shared/mocks/db";

// 11/10 민서 요청: 관리자 화면에서 시험 기종·기기·렌탈을 지운다. 이력이 있는 실제 데이터는 서버가 막는다

function addTestData() {
  const model = { ...db.models[0], modelCode: "TEST-MODEL", name: "TEST-NAME", manufacturer: "TEST" };
  db.models.push(model);
  const device = mockDevice("TEST-0003", model, "RETIRED");
  db.devices.push(device);
  const rental = {
    rentalId: nanoid(),
    deviceId: device.deviceId,
    renterRef: "TEST-R",
    status: "CLOSED" as const,
    startedAt: null,
    endedAt: null,
    createdAt: "2026-11-04T09:00:00Z",
    checkpoints: [],
  };
  db.rentals.push(rental);
  return { model, device, rental };
}

test("시험 기기(TEST-)는 확인 창을 거쳐 렌탈과 함께 지워지고 목록에서 사라진다", async () => {
  const { device } = addTestData();
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  const row = await screen.findByRole("listitem", { name: "TEST-0003" });
  await user.click(within(row).getByRole("button", { name: "상세보기" }));
  await user.click(within(row).getByRole("button", { name: "기기 지우기" }));
  expect(within(row).getByRole("alertdialog")).toHaveTextContent("렌탈과 검사 사진·기록도 모두 함께 지워지고");
  await user.click(within(within(row).getByRole("alertdialog")).getByRole("button", { name: "기기 지우기" }));
  await waitFor(() => expect(screen.queryByRole("listitem", { name: "TEST-0003" })).not.toBeInTheDocument());
  expect(db.rentals.some((r) => r.deviceId === device.deviceId)).toBe(false);
});

test("렌탈 이력이 있는 실제 기기는 지우지 않고 폐기로 바꾸라고 알린다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  const row = await screen.findByRole("listitem", { name: "C02AIR0001" });
  await user.click(within(row).getByRole("button", { name: "상세보기" }));
  await user.click(within(row).getByRole("button", { name: "기기 지우기" }));
  await user.click(within(within(row).getByRole("alertdialog")).getByRole("button", { name: "기기 지우기" }));
  expect(await within(row).findByRole("alert")).toHaveTextContent("폐기로 바꿔 주세요");
  expect(db.devices.some((d) => d.serial === "C02AIR0001")).toBe(true);
});

test("기기가 없는 기종은 지워지고, 기기가 등록된 기종은 이유를 보이며 남는다", async () => {
  db.models.push({ ...db.models[0], modelCode: "TEST-MODEL", name: "TEST-NAME" });
  const user = userEvent.setup();
  renderAsAdmin("/admin/models");
  const unused = await screen.findByRole("listitem", { name: "TEST-MODEL" });
  await user.click(within(unused).getByRole("button", { name: "삭제" }));
  await user.click(within(within(unused).getByRole("alertdialog")).getByRole("button", { name: "삭제" }));
  await waitFor(() => expect(screen.queryByRole("listitem", { name: "TEST-MODEL" })).not.toBeInTheDocument());

  const used = screen.getByRole("listitem", { name: "MBA13-M2" });
  await user.click(within(used).getByRole("button", { name: "삭제" }));
  await user.click(within(within(used).getByRole("alertdialog")).getByRole("button", { name: "삭제" }));
  expect(await within(used).findByRole("alert")).toHaveTextContent("기기를 먼저 지워 주세요");
  expect(db.models.some((m) => m.modelCode === "MBA13-M2")).toBe(true);
});

test("시험 렌탈 상세에만 지우기 버튼이 있고, 지우면 렌탈 목록으로 돌아간다", async () => {
  const { rental } = addTestData();
  const user = userEvent.setup();
  const { router } = renderAsAdmin(`/admin/rentals/${rental.rentalId}`);
  await user.click(await screen.findByRole("button", { name: "시험 렌탈 지우기" }));
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "시험 렌탈 지우기" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/rentals"));
  expect(db.rentals.some((r) => r.rentalId === rental.rentalId)).toBe(false);
});

test("실제 기기의 렌탈 상세에는 지우기 버튼이 없다", async () => {
  renderAsAdmin(`/admin/rentals/${db.rentals[0].rentalId}`);
  await screen.findByText("렌탈 기본 정보");
  expect(screen.queryByRole("button", { name: "시험 렌탈 지우기" })).not.toBeInTheDocument();
});

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { http, HttpResponse } from "msw";
import { server } from "../../shared/mocks/node";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint } from "../../shared/api/types";
import { captureDb } from "../../shared/mocks/captureDb";
import { db } from "../../shared/mocks/db";

const now = new Date().toISOString();

async function openRental(out: Checkpoint["status"]) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoints: Checkpoint[] = [{ checkpointId: nanoid(), type: "OUT", status: out, occurredAt: now }];
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3101", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints });
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  return { step: await screen.findByRole("listitem", { name: "출고" }), rentalId, checkpointId: checkpoints[0].checkpointId };
}

test("봉인 전 시점에서 진단 페어링 코드를 만들면 6자리 코드와 남은 시간이 보인다", async () => {
  const { step, rentalId, checkpointId } = await openRental("OPEN");
  await userEvent.setup().click(within(step).getByRole("button", { name: "진단 페어링 코드 만들기" }));
  expect(await within(step).findByLabelText("페어링 코드")).toHaveTextContent(/^\d{6}$/);
  expect(within(step).getByText(/남은 시간 \d분 \d+초/)).toBeInTheDocument();
  expect(captureDb.pairings).toMatchObject([{ rentalId, checkpointId }]);
});

test("5분이 지나면 코드를 가리고 새로 만들라고 알린다", async () => {
  const { step } = await openRental("OPEN");
  await userEvent.setup().click(within(step).getByRole("button", { name: "진단 페어링 코드 만들기" }));
  await within(step).findByLabelText("페어링 코드");
  const later = Date.now() + 5 * 60_000 + 1000;
  const spy = vi.spyOn(Date, "now").mockReturnValue(later);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1100));
  });
  expect(within(step).queryByLabelText("페어링 코드")).not.toBeInTheDocument();
  expect(within(step).getByRole("status")).toHaveTextContent("만료됐습니다");
  expect(within(step).getByRole("button", { name: "페어링 코드 다시 만들기" })).toBeInTheDocument();
  spy.mockRestore();
});

test("봉인된 시점에는 페어링 코드 버튼이 없다", async () => {
  const { step } = await openRental("SEALED");
  expect(within(step).queryByRole("button", { name: "진단 페어링 코드 만들기" })).not.toBeInTheDocument();
});

test("다시 만들기가 실패해도 아직 유효한 코드는 그대로 보인다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(within(step).getByRole("button", { name: "진단 페어링 코드 만들기" }));
  const first = (await within(step).findByLabelText("페어링 코드")).textContent;
  server.use(http.post("*/api/v1/auth/pairing-codes", () => HttpResponse.error()));
  await user.click(within(step).getByRole("button", { name: "페어링 코드 다시 만들기" }));
  expect(await within(step).findByRole("alert")).toBeInTheDocument();
  expect(within(step).getByLabelText("페어링 코드")).toHaveTextContent(first ?? "");
});

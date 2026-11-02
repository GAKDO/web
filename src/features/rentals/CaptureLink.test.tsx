import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { vi } from "vitest";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint } from "../../shared/api/types";
import { captureDb } from "../../shared/mocks/captureDb";
import { db } from "../../shared/mocks/db";

const now = new Date().toISOString();

/** 출고가 봉인되고 수령 시점이 status인 렌탈 상세를 연다 */
async function openRental(rcv: Checkpoint["status"] | null) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoints: Checkpoint[] = [{ checkpointId: nanoid(), type: "OUT", status: "SEALED", occurredAt: now }];
  if (rcv) checkpoints.push({ checkpointId: nanoid(), type: "RCV", status: rcv, occurredAt: null });
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3001", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints });
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  return { step: await screen.findByRole("listitem", { name: "수령" }), rentalId, rcvId: checkpoints[1]?.checkpointId };
}

test("수령 시점을 시작한 렌탈에서 수령 QR 만들기를 누르면 QR 그림, 링크 복사 버튼, 만료 시각이 보인다", async () => {
  const { step, rentalId, rcvId } = await openRental("OPEN");
  await userEvent.setup().click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  expect(await within(step).findByRole("img", { name: "수령 QR" })).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
  expect(within(step).getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  expect(within(step).getByText(/^만료 /)).toBeInTheDocument();
  expect(captureDb.links).toMatchObject([{ rentalId, checkpointId: rcvId }]);
});

test("QR을 다시 만들면 새 QR과 함께 이전 QR은 쓰지 말라는 안내가 보인다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  await user.click(await within(step).findByRole("button", { name: "QR 다시 만들기" }));
  expect(await within(step).findByText("새 QR을 만들었습니다. 이전 QR은 쓰지 마세요.")).toBeInTheDocument();
  expect(captureDb.links).toHaveLength(2);
});

test("수령 시점을 시작하기 전에는 QR 버튼이 없다", async () => {
  const before = await openRental(null);
  expect(within(before.step).queryByRole("button", { name: "수령 QR 만들기" })).not.toBeInTheDocument();
});

test("수령 촬영이 끝난(촬영됨) 시점에는 QR 버튼이 없다", async () => {
  const { step } = await openRental("CAPTURED");
  expect(within(step).queryByRole("button", { name: "수령 QR 만들기" })).not.toBeInTheDocument();
});

test("링크 복사가 되면 '링크 복사됨'이, 안 되면 QR을 읽게 하라는 안내가 보인다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  await user.click(await within(step).findByRole("button", { name: "링크 복사" }));
  expect(await within(step).findByRole("button", { name: "링크 복사됨" })).toBeInTheDocument();
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
  await user.click(within(step).getByRole("button", { name: "링크 복사됨" }));
  expect(await within(step).findByRole("alert")).toHaveTextContent("복사하지 못했습니다");
});

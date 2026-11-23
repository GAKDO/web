// 이 파일이 확인하는 것: 관리자 렌탈 상세의 "수령 QR" 버튼. 고객이 폰으로 찍으면 수령 촬영 화면이 열리는 QR을 만든다.
// 수령 시점이 시작됐고 아직 촬영이 끝나지 않았을 때만 보인다.

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
// 테스트 도구: 수령(RCV) 시점 상태를 원하는 값(없음·시작됨·촬영됨 등)으로 맞춘 렌탈을 만들고 관리자로 상세 화면을 연다.
async function openRental(rcv: Checkpoint["status"] | null) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoints: Checkpoint[] = [{ checkpointId: nanoid(), type: "OUT", status: "SEALED", occurredAt: now }];
  if (rcv) checkpoints.push({ checkpointId: nanoid(), type: "RCV", status: rcv, occurredAt: null });
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3001", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints });
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  return { step: await screen.findByRole("listitem", { name: "수령" }), rentalId, rcvId: checkpoints[1]?.checkpointId };
}

// [상황] 수령 시점을 시작한 렌탈에서 "수령 QR 만들기"를 누른다.
// [기대] QR 그림, "링크 복사" 버튼, 만료 시각이 보인다.
test("수령 시점을 시작한 렌탈에서 수령 QR 만들기를 누르면 QR 그림, 링크 복사 버튼, 만료 시각이 보인다", async () => {
  const { step, rentalId, rcvId } = await openRental("OPEN");
  await userEvent.setup().click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  expect(await within(step).findByRole("img", { name: "수령 QR" })).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
  expect(within(step).getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  expect(within(step).getByText(/^만료 /)).toBeInTheDocument();
  expect(captureDb.links).toMatchObject([{ rentalId, checkpointId: rcvId }]);
});

// [상황] QR을 한 번 만든 뒤 다시 만든다.
// [기대] 새 QR과 함께 "이전 QR은 쓰지 마세요" 안내가 보인다(이전 링크는 더 쓰지 않게).
test("QR을 다시 만들면 새 QR과 함께 이전 QR은 쓰지 말라는 안내가 보인다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  await user.click(await within(step).findByRole("button", { name: "QR 다시 만들기" }));
  expect(await within(step).findByText("새 QR을 만들었습니다. 이전 QR은 쓰지 마세요.")).toBeInTheDocument();
  expect(captureDb.links).toHaveLength(2);
});

// [상황] 수령 시점을 아직 시작하지 않은 렌탈을 연다.
// [기대] QR 버튼이 없다.
test("수령 시점을 시작하기 전에는 QR 버튼이 없다", async () => {
  const before = await openRental(null);
  expect(within(before.step).queryByRole("button", { name: "수령 QR 만들기" })).not.toBeInTheDocument();
});

// [상황] 수령 촬영이 이미 끝난(촬영됨) 렌탈을 연다.
// [기대] QR 버튼이 없다(다시 찍게 하지 않음).
test("수령 촬영이 끝난(촬영됨) 시점에는 QR 버튼이 없다", async () => {
  const { step } = await openRental("CAPTURED");
  expect(within(step).queryByRole("button", { name: "수령 QR 만들기" })).not.toBeInTheDocument();
});

// [상황] 링크 복사를 누른다. 한 번은 복사가 되고, 한 번은 브라우저가 복사를 막는다.
// [기대] 되면 버튼이 "링크 복사됨"으로 바뀌고, 안 되면 "복사하지 못했습니다" 경고가 보인다(그때는 QR을 폰으로 읽으면 됨).
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

// [상황] 링크 복사가 끝나기 전에 "다시 만들기"를 누르려 한다.
// [기대] 복사하는 동안 "QR 다시 만들기" 버튼이 눌리지 않고, 복사가 끝나면 다시 눌린다.
test("링크를 복사하는 동안에는 QR을 다시 만들 수 없다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(within(step).getByRole("button", { name: "수령 QR 만들기" }));
  let finish: () => void = () => undefined;
  vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(new Promise<void>((r) => (finish = r)));
  await user.click(await within(step).findByRole("button", { name: "링크 복사" }));
  expect(within(step).getByRole("button", { name: "QR 다시 만들기" })).toBeDisabled();
  finish();
  expect(await within(step).findByRole("button", { name: "링크 복사됨" })).toBeInTheDocument();
  expect(within(step).getByRole("button", { name: "QR 다시 만들기" })).toBeEnabled();
});

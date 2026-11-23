// 이 파일이 확인하는 것: 관리자가 부스 옆에서 쓰는 부스 화면(/booth).
// 검사 기다리는 기기를 골라 부스(Jetson)에 넣을 6자리 부스 코드를 발급하고, 찍은 기기의 판정을 크게 보여 준다.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { vi } from "vitest";
import { renderApp, renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint, Inspection } from "../../shared/api/types";
import { db } from "../../shared/mocks/db";

/** 사용 가능 기기 하나로 시점이 하나 있는 렌탈을 넣고, 원하면 그 시점의 검사 결과도 넣는다 */
function addRental(serial: string, status: Checkpoint["status"], inspection?: Omit<Inspection, "checkpointId">) {
  const device = db.devices.find((d) => d.serial === serial);
  const rentalId = nanoid();
  const checkpointId = nanoid();
  const now = new Date().toISOString();
  db.rentals.push({
    rentalId,
    deviceId: device?.deviceId ?? "",
    renterRef: "R-5001",
    status: "OPEN",
    startedAt: now,
    endedAt: null,
    createdAt: now,
    checkpoints: [{ checkpointId, type: "OUT", status, occurredAt: status === "OPEN" ? null : now }],
  });
  if (inspection) db.report.inspections.set(checkpointId, { checkpointId, ...inspection });
  return { rentalId, checkpointId };
}

// [상황] 로그인하지 않고 부스 화면을 연다.
// [기대] 부스 화면 제목과 관리자 로그인 칸(이메일)이 보인다.
test("로그인하지 않고 부스 화면을 열면 관리자 로그인 칸이 보인다", async () => {
  renderApp("/booth");
  expect(await screen.findByRole("heading", { name: "부스 화면" })).toBeInTheDocument();
  expect(screen.getByLabelText("이메일")).toBeInTheDocument();
});

// [상황] 아직 찍지 않은 기기가 있고, 관리자가 그 기기를 골라 "부스 코드 발급"을 누른다.
// [기대] 기기가 "검사 기다리는 기기"에 있고, 부스(Jetson) 화면에 넣으라는 안내와 6자리 숫자 코드가 보인다.
test("찍기 전 기기는 검사 기다리는 기기에 있고, 고르면 부스 코드를 발급할 수 있다", async () => {
  addRental("C02AIR0002", "OPEN");
  const u = userEvent.setup();
  renderAsAdmin("/booth");
  const waiting = await screen.findByRole("region", { name: "검사 기다리는 기기" });
  await u.click(await within(waiting).findByRole("button", { name: /C02AIR0002/ }));
  const panel = screen.getByRole("region", { name: "고른 기기" });
  expect(within(panel).getByText(/부스\(Jetson\) 화면/)).toBeInTheDocument();
  await u.click(within(panel).getByRole("button", { name: "부스 코드 발급" }));
  expect(await within(panel).findByLabelText("부스 코드 6자리")).toHaveTextContent(/^\d{6}$/);
});

// [상황] 검사가 끝나 C 등급("스크래치 2개")을 받은 기기를 고른다.
// [기대] "최근 판정"에 있고, 큰 글자로 "문제 있음"과 사유 "스크래치 2개"가 보인다.
test("찍은 기기는 최근 판정에 있고, 고르면 큰 판정 글자(문제 없음/문제 있음)가 보인다", async () => {
  addRental("LGGRAM0003", "GRADED", { grade: "C", ruleVersion: "r1", reasons: ["스크래치 2개"], defects: [] });
  const u = userEvent.setup();
  renderAsAdmin("/booth");
  const judged = await screen.findByRole("region", { name: "최근 판정" });
  await u.click(await within(judged).findByRole("button", { name: /LGGRAM0003/ }));
  const verdict = await screen.findByRole("status", { name: "판정" });
  expect(await within(verdict).findByText(/문제 있음/)).toBeInTheDocument();
  expect(within(verdict).getByText(/스크래치 2개/)).toBeInTheDocument();
});

// [상황] 기기 A를 골라 부스 코드를 받은 뒤 기기 B를 고른다.
// [기대] A의 코드가 사라지고 다시 "부스 코드 발급" 버튼이 보인다(A의 코드로 B를 찍는 실수 방지).
test("기기 A에 발급한 부스 코드는 기기 B를 고르면 사라진다(다른 기기로 잘못 찍지 않게)", async () => {
  addRental("C02AIR0002", "OPEN");
  addRental("LGGRAM0003", "OPEN");
  const u = userEvent.setup();
  renderAsAdmin("/booth");
  const waiting = await screen.findByRole("region", { name: "검사 기다리는 기기" });
  await u.click(await within(waiting).findByRole("button", { name: /C02AIR0002/ }));
  const panel = screen.getByRole("region", { name: "고른 기기" });
  await u.click(within(panel).getByRole("button", { name: "부스 코드 발급" }));
  await within(panel).findByLabelText("부스 코드 6자리");
  await u.click(within(waiting).getByRole("button", { name: /LGGRAM0003/ }));
  expect(within(panel).queryByLabelText("부스 코드 6자리")).not.toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "부스 코드 발급" })).toBeInTheDocument();
});

// [상황] 오래전에 만든 기다리는 기기 뒤로 끝난 렌탈 25건이 더 생겼다.
// [기대] 기다리는 기기가 목록에서 빠지지 않고 보인다.
test("렌탈이 한 쪽(20건)보다 많아도 오래전에 만든 기다리는 기기가 목록에 보인다", async () => {
  addRental("C02AIR0002", "OPEN");
  for (let i = 0; i < 25; i += 1) {
    const now = new Date().toISOString();
    db.rentals.push({ rentalId: nanoid(), deviceId: "x", renterRef: `R-${i}`, status: "CLOSED", startedAt: now, endedAt: now, createdAt: now, checkpoints: [] });
  }
  renderAsAdmin("/booth");
  const waiting = await screen.findByRole("region", { name: "검사 기다리는 기기" });
  expect(await within(waiting).findByRole("button", { name: /C02AIR0002/ })).toBeInTheDocument();
});

// [상황] 폰 폭(375px) 화면에서 기다리는 기기를 처음 고른다.
// [기대] "고른 기기" 칸이 다 그려진 뒤에 그 칸으로 한 번 스크롤한다(빈 칸으로 내려가지 않게).
test("폰 폭에서 기기를 처음 고르면 고른 기기 칸이 그려진 뒤에 그 칸으로 내린다", async () => {
  addRental("C02AIR0002", "OPEN");
  const width = vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
  // 내릴 때 고른 기기 칸에 결과가 이미 그려져 있었는지 기록한다
  const rendered: boolean[] = [];
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    if (this.id === "booth-panel") rendered.push(this.textContent?.includes("부스 코드 발급") ?? false);
  };
  try {
    const u = userEvent.setup();
    renderAsAdmin("/booth");
    const waiting = await screen.findByRole("region", { name: "검사 기다리는 기기" });
    await u.click(await within(waiting).findByRole("button", { name: /C02AIR0002/ }));
    await vi.waitFor(() => expect(rendered).toEqual([true]));
  } finally {
    Element.prototype.scrollIntoView = original;
    width.mockRestore();
  }
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
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

test("로그인하지 않고 부스 화면을 열면 관리자 로그인 칸이 보인다", async () => {
  renderApp("/booth");
  expect(await screen.findByRole("heading", { name: "부스 화면" })).toBeInTheDocument();
  expect(screen.getByLabelText("이메일")).toBeInTheDocument();
});

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

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { vi } from "vitest";
import { renderApp, renderAsAdmin } from "../../test/renderApp";
import { captureTokenStore } from "../../shared/auth/captureTokenStore";
import { mockCaptureLink } from "../../shared/mocks/captureDb";
import { db } from "../../shared/mocks/db";

// 폰 수령 촬영(WE2)을 숨긴 시연 배포(11/6): 같은 수령 QR로 렌탈을 고객 계정에 연결만 한다
beforeEach(() => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function quickRental() {
  const rental = db.rentals.find((r) => r.renterRef === "R-1002");
  if (!rental) throw new Error("목 렌탈 없음");
  return rental;
}

/** 렌탈이 하나도 없는 새 고객 */
function newCustomer() {
  const account = { accountId: nanoid(), email: "new@example.com", password: "example-pass-5678", role: "CUSTOMER" as const };
  db.accounts.push(account);
  db.refreshAccount = account;
  return account;
}

test("폰 촬영을 숨긴 배포에서 관리자가 렌탈 상세를 열면 고객 연결 QR을 만들 수 있다", async () => {
  const u = userEvent.setup();
  renderAsAdmin(`/admin/rentals/${quickRental().rentalId}`);
  await u.click(await screen.findByRole("button", { name: "고객 연결 QR 만들기" }));
  expect(await screen.findByRole("img", { name: "고객 연결 QR" })).toBeInTheDocument();
  expect(screen.getByText(/로그인하면 이 렌탈이 고객 계정에 연결되어/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "수령 QR 만들기" })).not.toBeInTheDocument();
});

test("렌탈이 없는 고객이 연결 QR을 열면 카메라 없이 렌탈이 연결되고 내 렌탈에 그 렌탈이 보인다", async () => {
  newCustomer();
  const rental = quickRental();
  const link = mockCaptureLink(rental.rentalId, rental.checkpoints[0].checkpointId);
  const { router } = renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByRole("heading", { name: "렌탈이 내 계정에 연결되었습니다" })).toBeInTheDocument();
  expect(router.state.location.search).toBe("");
  // 촬영 권한은 쓰지 않으므로 남기지 않는다
  expect(captureTokenStore.get()).toBeNull();
  const u = userEvent.setup();
  await u.click(screen.getByRole("link", { name: "내 렌탈 목록" }));
  const list = [...(await screen.findByRole("list", { name: "내 노트북" })).children];
  expect(list).toHaveLength(1);
  expect(within(list[0] as HTMLElement).getByRole("link", { name: "리포트 보기" })).toHaveAttribute("href", `/my/rentals/${rental.rentalId}`);
});

test("다른 고객에게 이미 연결된 렌탈의 QR을 열면 다른 계정이라는 문장과 로그아웃 버튼이 보인다", async () => {
  const rental = quickRental();
  db.report.owners.set(rental.rentalId, "someone-else");
  const { captureDb } = await import("../../shared/mocks/captureDb");
  captureDb.rentalOwner.set(rental.rentalId, "someone-else");
  newCustomer();
  const link = mockCaptureLink(rental.rentalId, rental.checkpoints[0].checkpointId);
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/다른 계정에 연결된 렌탈입니다/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

test("리포트까지 숨긴 배포에서는 QR 주소를 열어도 첫 화면으로 돌아간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,report");
  newCustomer();
  const link = mockCaptureLink();
  const { router } = renderApp(`/capture?t=${link.token}`);
  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
});

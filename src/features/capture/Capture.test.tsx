import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp } from "../../test/renderApp";
import { api, unwrap } from "../../shared/api/client";
import { tokenStore } from "../../shared/auth/tokenStore";
import { exchangeOnce } from "./api/exchange";
import { captureTokenStore } from "../../shared/auth/captureTokenStore";
import { captureDb, mockCaptureLink } from "../../shared/mocks/captureDb";
import { db, MOCK_CUSTOMER } from "../../shared/mocks/db";
import * as camera from "./camera";
import { blurredGray, fakeShot, glareGray, sharpGray } from "./testing";

vi.mock("./camera", async (importOriginal) => {
  const real = await importOriginal<typeof import("./camera")>();
  return { ...real, isSecure: vi.fn(), hasCameraApi: vi.fn(), openCamera: vi.fn(), attachStream: vi.fn(), stopCamera: vi.fn(), captureShot: vi.fn() };
});
const cam = vi.mocked(camera);

beforeEach(() => {
  cam.isSecure.mockReturnValue(true);
  cam.hasCameraApi.mockReturnValue(true);
  cam.openCamera.mockResolvedValue({} as MediaStream);
  cam.captureShot.mockResolvedValue(fakeShot(sharpGray()));
});

function asCustomer() {
  db.refreshAccount = db.accounts.find((a) => a.role === "CUSTOMER") ?? null;
}

async function openTop() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /^윗면/ }));
  return user;
}

test("로그인하지 않은 고객이 QR 링크를 열면 로그인 화면이 열리고, 로그인하면 촬영 면 목록으로 돌아오며 주소창에서 토큰이 지워진다", async () => {
  const link = mockCaptureLink();
  const { router } = renderApp(`/capture?t=${link.token}`);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("이메일"), MOCK_CUSTOMER.email);
  await user.type(screen.getByLabelText("비밀번호"), MOCK_CUSTOMER.password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByRole("heading", { name: "수령 사진 찍기" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(8);
  expect(screen.getByText(/화면\(흰색\) \(선택\)/)).toBeInTheDocument();
  expect(screen.queryByText(/키보드/)).not.toBeInTheDocument();
  expect(router.state.location.search).toBe("");
  expect(captureTokenStore.get()?.checkpointId).toBe(link.checkpointId);
});

test("만료됐거나 이미 쓴 QR을 열면 새 QR을 받으라는 문장이 보인다", async () => {
  const link = mockCaptureLink();
  link.used = true;
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/만료되었거나 이미 사용한 QR입니다/)).toBeInTheDocument();
});

test("다른 고객 계정에 연결된 렌탈의 QR을 열면 그 사실과 로그아웃 버튼이 보인다", async () => {
  const link = mockCaptureLink();
  captureDb.rentalOwner.set(link.rentalId, "someone-else");
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/다른 계정에 연결된 렌탈입니다/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

test("보안 연결이 아니면 카메라를 켜지 않고 QR도 쓰지 않는다", async () => {
  cam.isSecure.mockReturnValue(false);
  const link = mockCaptureLink();
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/보안 연결\(https\)에서만 촬영할 수 있습니다/)).toBeInTheDocument();
  expect(link.used).toBe(false);
  expect(cam.openCamera).not.toHaveBeenCalled();
});

test("https여도 브라우저가 카메라를 못 쓰면 https 안내 대신 브라우저 안내를 보이고 QR을 쓰지 않는다", async () => {
  cam.hasCameraApi.mockReturnValue(false);
  const link = mockCaptureLink();
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/이 브라우저는 카메라를 쓸 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByText(/보안 연결/)).not.toBeInTheDocument();
  expect(link.used).toBe(false);
});

test("윗면(덮개)을 고르면 윤곽 설명이 보이고, 흔들린 사진은 쓸 수 없으며 다시 찍어 통과하면 체크되고 다음 면으로 넘어간다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  expect(screen.getByText(/위에서 덮개 전체가 윤곽선 안에/)).toBeInTheDocument();
  cam.captureShot.mockResolvedValueOnce(fakeShot(blurredGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  expect(await screen.findByText(/사진이 흔들렸습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 사진 쓰기" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "다시 찍기" }));
  await user.click(screen.getByRole("button", { name: "찍기" }));
  await user.click(await screen.findByRole("button", { name: "이 사진 쓰기" }));
  expect(await screen.findByRole("heading", { name: "바닥" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "면 목록으로" }));
  expect(screen.getByRole("button", { name: /^윗면.*✓ 찍음/ })).toBeInTheDocument();
  expect(screen.getByText(/남은 필수 면: 바닥, 앞 옆면/)).toBeInTheDocument();
});

test("빛 반사가 있는 사진은 이유를 보여 주고 쓸 수 없다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  cam.captureShot.mockResolvedValueOnce(fakeShot(glareGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  expect(await screen.findByText(/빛이 반사됩니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 사진 쓰기" })).not.toBeInTheDocument();
});

test("카메라 권한을 거부하면 이유와 다시 허용하는 방법이 보이고, 다시 시도하면 카메라를 다시 연다", async () => {
  cam.openCamera.mockRejectedValueOnce(new camera.CameraError("denied"));
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  expect(await screen.findByText("사진을 찍으려면 카메라 권한이 필요합니다.")).toBeInTheDocument();
  expect(screen.getByText(/iPhone\(Safari\)/)).toBeInTheDocument();
  expect(screen.getByText(/Android\(Chrome\)/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByRole("button", { name: "찍기" })).toBeInTheDocument();
});

test("새로 고쳐 촬영 정보를 잃으면 새 QR을 받으라고 안내하고, 촬영 화면에는 새로 고치지 말라는 안내가 늘 보인다", async () => {
  asCustomer();
  renderApp("/capture");
  expect(await screen.findByText(/촬영 정보가 없습니다/)).toBeInTheDocument();
});

test("촬영 시간이 5분 아래로 남으면 남은 시간을 알린다", async () => {
  asCustomer();
  captureTokenStore.set({ accessToken: "cap.x", tokenType: "Bearer", expiresIn: 4 * 60, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderApp("/capture");
  expect(await screen.findByText("촬영 시간이 4분 남았습니다. 서둘러 제출해 주세요.")).toBeInTheDocument();
  expect(screen.getByText(/새로 고치거나 창을 닫지 마세요/)).toBeInTheDocument();
});

test("같은 QR 토큰으로 교환을 두 번 불러도 요청은 한 번만 가 두 번째가 실패하지 않는다", async () => {
  const link = mockCaptureLink();
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: MOCK_CUSTOMER })));
  const [a, b] = await Promise.all([exchangeOnce(link.token), exchangeOnce(link.token)]);
  expect(a).toBe(b);
  expect(link.used).toBe(true);
});

test("촬영 시간이 지나면 면 목록과 찍기 버튼을 숨기고 새 QR 안내만 보인다", async () => {
  asCustomer();
  captureTokenStore.set({ accessToken: "cap.x", tokenType: "Bearer", expiresIn: 0, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderApp("/capture");
  expect(await screen.findByText(/촬영 시간이 지났습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /윗면/ })).not.toBeInTheDocument();
});

test("교환이 끝난 QR 토큰은 기억하지 않아, 다시 부르면 서버의 410을 그대로 받는다", async () => {
  const link = mockCaptureLink();
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: MOCK_CUSTOMER })));
  await exchangeOnce(link.token);
  await expect(exchangeOnce(link.token)).rejects.toMatchObject({ status: 410 });
});

test("다시 찍으면 버린 사진의 미리보기 URL을 해제한다", async () => {
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  cam.captureShot.mockResolvedValueOnce(fakeShot(blurredGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  await user.click(await screen.findByRole("button", { name: "다시 찍기" }));
  expect(revoke).toHaveBeenCalled();
});

test("QR 교환을 기다리는 사이 로그아웃하면 늦게 온 촬영 허가를 저장하지 않는다", async () => {
  const link = mockCaptureLink();
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: MOCK_CUSTOMER })));
  const pending = exchangeOnce(link.token);
  captureTokenStore.clear();
  const afterLogout = exchangeOnce(link.token);
  expect(afterLogout).not.toBe(pending);
  await expect(pending).rejects.toThrow();
  await afterLogout.catch(() => undefined);
  expect(captureTokenStore.get()).toBeNull();
});

test("면 목록으로 돌아가면 쓰지 않은 사진의 미리보기 URL을 해제한다", async () => {
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  await screen.findByRole("button", { name: "이 사진 쓰기" });
  revoke.mockClear();
  await user.click(screen.getByRole("button", { name: "면 목록으로" }));
  expect(revoke).toHaveBeenCalledTimes(1);
});

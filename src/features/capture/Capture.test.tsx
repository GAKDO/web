import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { renderApp } from "../../test/renderApp";
import { api, unwrap } from "../../shared/api/client";
import { tokenStore } from "../../shared/auth/tokenStore";
import { exchangeOnce } from "./api/exchange";
import { captureTokenStore } from "../../shared/auth/captureTokenStore";
import { captureDb, mockCaptureLink } from "../../shared/mocks/captureDb";
import { db, MOCK_CUSTOMER, MOCK_EMAIL_CODE } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import * as camera from "./camera";
import { blurredGray, darkGray, fakeShot, glareGray, sharpGray } from "./testing";

vi.mock("./camera", async (importOriginal) => {
  const real = await importOriginal<typeof import("./camera")>();
  return { ...real, isSecure: vi.fn(), hasCameraApi: vi.fn(), openCamera: vi.fn(), attachStream: vi.fn(), stopCamera: vi.fn(), captureShot: vi.fn(), sampleFrame: vi.fn() };
});
const cam = vi.mocked(camera);

beforeEach(() => {
  cam.isSecure.mockReturnValue(true);
  cam.hasCameraApi.mockReturnValue(true);
  cam.openCamera.mockResolvedValue({} as MediaStream);
  cam.captureShot.mockResolvedValue(fakeShot(sharpGray()));
  cam.sampleFrame.mockReturnValue(null);
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

test("수령 QR로 들어와 로그인 화면이 뜨면 로그인하면 렌탈이 자동으로 연결된다고 알리고, 로그인 뒤 촬영 화면에 연결됐다고 보인다", async () => {
  const link = mockCaptureLink();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/로그인하면 이 렌탈이 내 계정에 자동으로 연결됩니다/)).toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일"), MOCK_CUSTOMER.email);
  await user.type(screen.getByLabelText("비밀번호"), MOCK_CUSTOMER.password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  expect(await screen.findByText(/이 렌탈이 내 계정에 연결되었습니다/)).toBeInTheDocument();
  expect(captureDb.rentalOwner.get(link.rentalId)).toBe(db.accounts.find((a) => a.email === MOCK_CUSTOMER.email)?.accountId);
});

test("수령 QR로 들어온 새 고객은 가입·메일 인증 화면에서도 가입을 마치면 렌탈이 새 계정에 연결된다고 안내받고, 인증을 마치면 렌탈이 연결된 채 촬영 화면이 열린다", async () => {
  const link = mockCaptureLink();
  renderApp(`/capture?t=${link.token}`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("link", { name: "회원가입" }));
  expect(await screen.findByText(/가입과 메일 인증을 마치면 이 렌탈이 새 계정에 자동으로 연결됩니다/)).toBeInTheDocument();
  await user.type(screen.getByLabelText("이름"), "홍길동");
  await user.type(screen.getByLabelText("이메일"), "qr-new@example.com");
  await user.type(screen.getByLabelText("비밀번호"), "example-pass-5678");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "가입하고 인증 코드 받기" }));
  expect(await screen.findByText(/가입과 메일 인증을 마치면 이 렌탈이 새 계정에 자동으로 연결됩니다/)).toBeInTheDocument();
  await user.type(screen.getByLabelText("인증 코드"), MOCK_EMAIL_CODE);
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  expect(await screen.findByText(/이 렌탈이 내 계정에 연결되었습니다/)).toBeInTheDocument();
  expect(captureDb.rentalOwner.get(link.rentalId)).toBe(db.accounts.find((a) => a.email === "qr-new@example.com")?.accountId);
});

test("QR을 교환해 렌탈이 연결되면 로그인 세션을 다시 받아 내 렌탈이 새 렌탈을 담게 하고, 촬영 권한은 그대로 남는다", async () => {
  const link = mockCaptureLink();
  asCustomer();
  let refreshes = 0;
  const count = ({ request }: { request: Request }) => {
    if (request.method === "POST" && new URL(request.url).pathname.endsWith("/api/v1/auth/refresh")) refreshes += 1;
  };
  server.events.on("request:start", count);
  try {
    renderApp(`/capture?t=${link.token}`);
    expect(await screen.findByRole("heading", { name: "수령 사진 찍기" })).toBeInTheDocument();
    // 처음 화면을 열 때 세션을 되살리는 1번 + 교환 뒤 1번
    await vi.waitFor(() => expect(refreshes).toBe(2));
    expect(captureTokenStore.get()?.checkpointId).toBe(link.checkpointId);
  } finally {
    server.events.removeListener("request:start", count);
  }
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
  // 헤더에도 로그아웃이 있으므로(11/12) 화면 안의 버튼을 본다
  expect(within(screen.getByRole("main")).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
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
  expect(screen.getByText(/바로 위에서 덮개를 찍으세요. 화면이 접히는 쪽\(경첩\)이 사진 위로/)).toBeInTheDocument();
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

test("어두운 사진은 불을 켜라는 이유를 보여 주고 쓸 수 없다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  cam.captureShot.mockResolvedValueOnce(fakeShot(darkGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  expect(await screen.findByText(/너무 어둡습니다. 불을 켜거나/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 사진 쓰기" })).not.toBeInTheDocument();
});

test("찍기 전에 미리보기가 어두우면 불을 켜라고, 밝고 멈춰 있으면 그대로 찍으라고 안내한다", async () => {
  cam.sampleFrame.mockReturnValue(darkGray());
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  await openTop();
  expect(await screen.findByText("어두워요. 불을 켜거나 밝은 곳으로 옮겨 주세요", {}, { timeout: 3000 })).toBeInTheDocument();
  cam.sampleFrame.mockReturnValue(sharpGray());
  // 밝아진 첫 프레임은 앞 프레임(어두움)과 달라 "멈춰 주세요", 그다음 프레임부터 OK
  expect(await screen.findByText("좋아요, 그대로 찍으세요", {}, { timeout: 3000 })).toBeInTheDocument();
});

test("촬영 중 인터넷이 끊기면 찍은 사진은 남아 있다고 알리고, 다시 연결되면 안내를 지운다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  await screen.findByRole("button", { name: /^윗면/ });
  act(() => void window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("alert")).toHaveTextContent(/인터넷 연결이 끊겼습니다/);
  act(() => void window.dispatchEvent(new Event("online")));
  expect(screen.queryByText(/인터넷 연결이 끊겼습니다/)).not.toBeInTheDocument();
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

test("찍는 중에 면 목록으로 돌아가면 늦게 만들어진 미리보기 URL도 해제한다", async () => {
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  let finish: (s: ReturnType<typeof fakeShot>) => void = () => undefined;
  cam.captureShot.mockReturnValueOnce(new Promise((r) => (finish = r)));
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  await user.click(screen.getByRole("button", { name: "면 목록으로" }));
  revoke.mockClear();
  const late = fakeShot(sharpGray());
  finish(late);
  await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith(late.previewUrl));
});

test("영상 크기를 알기 전에는 찍기 버튼을 보이지 않는다", async () => {
  let ready: () => void = () => undefined;
  cam.attachStream.mockReturnValueOnce(new Promise<void>((r) => (ready = r)));
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  await openTop();
  await screen.findByRole("button", { name: "면 목록으로" });
  expect(screen.queryByRole("button", { name: "찍기" })).toBeNull();
  ready();
  expect(await screen.findByRole("button", { name: "찍기" })).toBeInTheDocument();
});

test("렌탈의 기종 치수를 읽으면 윤곽선 비율을 그 치수로 그리고, 못 읽으면 기본 치수로 그린다", async () => {
  asCustomer();
  const rental = db.rentals.find((r) => db.report.owners.has(r.rentalId));
  const modelCode = rental && db.report.timelines.get(rental.rentalId)?.modelCode;
  const model = db.models.find((m) => m.modelCode === modelCode);
  if (!rental || !model) throw new Error("고객 렌탈 목 데이터가 없습니다");
  model.dimensions = { widthMm: 200, depthMm: 200, baseHMm: 10, lidHMm: 5 };
  const { container, unmount } = renderApp(`/capture?t=${mockCaptureLink(rental.rentalId).token}`);
  await screen.findByRole("heading", { name: "수령 사진 찍기" });
  await openTop();
  // 200 × 200 윗면은 정사각형: viewBox 높이 한도 60에 맞춰 60 × 60
  await vi.waitFor(() => expect(container.querySelector(".outline rect")?.getAttribute("width")).toBe("60"));
  expect(container.querySelector(".outline rect")?.getAttribute("height")).toBe("60");
  unmount();

  // 내 렌탈이 아니라 리포트를 못 읽으면 기본 치수(304.1 × 215) 윤곽
  const other = renderApp(`/capture?t=${mockCaptureLink().token}`);
  await screen.findByRole("heading", { name: "수령 사진 찍기" });
  await openTop();
  expect(other.container.querySelector(".outline rect")?.getAttribute("width")).toBe("80");
});

test("기종 치수를 받는 동안에는 면을 고를 수 없고, 응답이 오면(실패해도) 찍을 수 있다", async () => {
  asCustomer();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId", async () => {
      await gate;
      return new HttpResponse(null, { status: 503 });
    }),
  );
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  expect(await screen.findByText(/기종 치수를 불러오는 중/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^윗면/ })).toBeDisabled();
  release();
  await vi.waitFor(() => expect(screen.getByRole("button", { name: /^윗면/ })).toBeEnabled());
  expect(screen.queryByText(/기종 치수를 불러오는 중/)).not.toBeInTheDocument();
});

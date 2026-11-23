// 이 파일이 확인하는 것: 고객 폰 수령 촬영 화면(/capture). 관리자가 준 수령 QR을 열면 로그인(또는 가입) 뒤 렌탈이 내 계정에 연결되고,
// QR을 30분짜리 "촬영 권한"으로 바꿔 노트북 면마다 사진을 찍는다. 흔들림·반사·어두움은 바로 걸러 다시 찍게 한다.
// 카메라는 가짜로 바꿔, 테스트가 찍힐 사진(선명·흐림·반사·어두움)과 미리보기 화면을 정한다.

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

// 테스트 도구: 카메라 기능을 모두 가짜로 바꾼다.
vi.mock("./camera", async (importOriginal) => {
  const real = await importOriginal<typeof import("./camera")>();
  return { ...real, isSecure: vi.fn(), hasCameraApi: vi.fn(), openCamera: vi.fn(), attachStream: vi.fn(), stopCamera: vi.fn(), captureShot: vi.fn(), sampleFrame: vi.fn() };
});
// 테스트 도구: 가짜 카메라 기능 묶음(테스트마다 돌려줄 값을 정함).
const cam = vi.mocked(camera);

// 테스트 도구: 기본은 HTTPS·카메라 있음·카메라 켜짐·찍으면 선명한 사진·미리보기 분석 없음으로 둔다.
beforeEach(() => {
  cam.isSecure.mockReturnValue(true);
  cam.hasCameraApi.mockReturnValue(true);
  cam.openCamera.mockResolvedValue({} as MediaStream);
  cam.captureShot.mockResolvedValue(fakeShot(sharpGray()));
  cam.sampleFrame.mockReturnValue(null);
});

// 테스트 도구: 고객이 로그인한 상태(리프레시 쿠키)를 만든다.
function asCustomer() {
  db.refreshAccount = db.accounts.find((a) => a.role === "CUSTOMER") ?? null;
}

// 테스트 도구: 면 목록에서 "윗면"을 눌러 촬영 화면을 연다.
async function openTop() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /^윗면/ }));
  return user;
}

// [상황] 로그인하지 않은 고객이 수령 QR 링크를 열고 로그인한다.
// [기대] 로그인 화면이 열리고, 로그인하면 "수령 사진 찍기" 면 목록 8칸(흰 화면은 선택, 키보드는 없음)으로 돌아온다.
//        주소창의 QR 토큰은 지워지고, 그 시점의 촬영 권한이 화면 메모리에 생긴다.
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

// [상황] 수령 QR로 들어와 로그인 화면을 보고 로그인한다.
// [기대] 로그인 전엔 "로그인하면 이 렌탈이 내 계정에 자동으로 연결됩니다", 로그인 뒤엔 "이 렌탈이 내 계정에 연결되었습니다"가 보이고,
//        렌탈 주인이 그 고객으로 정해진다.
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

// [상황] 수령 QR로 들어온 새 고객이 회원가입·메일 인증을 마친다.
// [기대] 가입·인증 화면 내내 렌탈이 새 계정에 연결된다는 안내가 보이고, 인증을 마치면 렌탈이 새 계정에 연결된 채 촬영 화면이 열린다.
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

// [상황] 로그인한 고객이 QR을 열어 렌탈이 연결된다.
// [기대] 로그인 세션을 한 번 더 새로 받아(처음 화면 열 때 1번 + 연결 뒤 1번) 내 렌탈 목록에 새 렌탈이 담기게 하고, 촬영 권한은 그대로 남는다.
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

// [상황] 이미 쓴 QR을 연다.
// [기대] "만료되었거나 이미 사용한 QR입니다"와 새 QR을 받으라는 안내가 보인다.
test("만료됐거나 이미 쓴 QR을 열면 새 QR을 받으라는 문장이 보인다", async () => {
  const link = mockCaptureLink();
  link.used = true;
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/만료되었거나 이미 사용한 QR입니다/)).toBeInTheDocument();
});

// [상황] 이미 다른 고객에게 연결된 렌탈의 QR을 연다.
// [기대] "다른 계정에 연결된 렌탈입니다"와 화면 안 로그아웃 버튼이 보인다.
test("다른 고객 계정에 연결된 렌탈의 QR을 열면 그 사실과 로그아웃 버튼이 보인다", async () => {
  const link = mockCaptureLink();
  captureDb.rentalOwner.set(link.rentalId, "someone-else");
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/다른 계정에 연결된 렌탈입니다/)).toBeInTheDocument();
  // 헤더에도 로그아웃이 있으므로(11/12) 화면 안의 버튼을 본다
  expect(within(screen.getByRole("main")).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

// [상황] HTTPS가 아닌 주소로 열었다.
// [기대] HTTPS에서만 찍을 수 있다는 안내만 보이고, QR을 쓰지도(일회용이 소모되지 않음) 카메라를 켜지도 않는다.
test("보안 연결이 아니면 카메라를 켜지 않고 QR도 쓰지 않는다", async () => {
  cam.isSecure.mockReturnValue(false);
  const link = mockCaptureLink();
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/보안 연결\(https\)에서만 촬영할 수 있습니다/)).toBeInTheDocument();
  expect(link.used).toBe(false);
  expect(cam.openCamera).not.toHaveBeenCalled();
});

// [상황] HTTPS지만 브라우저에 카메라 기능이 없다.
// [기대] HTTPS 안내 대신 "이 브라우저는 카메라를 쓸 수 없습니다"가 보이고, QR을 쓰지 않는다.
test("https여도 브라우저가 카메라를 못 쓰면 https 안내 대신 브라우저 안내를 보이고 QR을 쓰지 않는다", async () => {
  cam.hasCameraApi.mockReturnValue(false);
  const link = mockCaptureLink();
  asCustomer();
  renderApp(`/capture?t=${link.token}`);
  expect(await screen.findByText(/이 브라우저는 카메라를 쓸 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByText(/보안 연결/)).not.toBeInTheDocument();
  expect(link.used).toBe(false);
});

// [상황] 윗면을 골라 흔들린 사진을 찍고, 다시 찍어 선명한 사진을 쓴다.
// [기대] 경첩이 사진 위로 오게 찍으라는 설명이 보인다. 흔들린 사진은 "사진이 흔들렸습니다"로 쓸 수 없고, 선명한 사진을 쓰면
//        다음 면(바닥)으로 넘어간다. 면 목록에서 윗면엔 "✓ 찍음"이, 남은 필수 면엔 바닥부터 보인다.
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

// [상황] 빛 반사로 하얗게 날아간 사진을 찍는다.
// [기대] "빛이 반사됩니다"가 보이고 그 사진은 쓸 수 없다.
test("빛 반사가 있는 사진은 이유를 보여 주고 쓸 수 없다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  cam.captureShot.mockResolvedValueOnce(fakeShot(glareGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  expect(await screen.findByText(/빛이 반사됩니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 사진 쓰기" })).not.toBeInTheDocument();
});

// [상황] 어두운 사진을 찍는다.
// [기대] "너무 어둡습니다. 불을 켜거나…"가 보이고 그 사진은 쓸 수 없다.
test("어두운 사진은 불을 켜라는 이유를 보여 주고 쓸 수 없다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  const user = await openTop();
  cam.captureShot.mockResolvedValueOnce(fakeShot(darkGray()));
  await user.click(await screen.findByRole("button", { name: "찍기" }));
  expect(await screen.findByText(/너무 어둡습니다. 불을 켜거나/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "이 사진 쓰기" })).not.toBeInTheDocument();
});

// [상황] 찍기 전 카메라 미리보기가 어두웠다가 밝아지고 멈춘다.
// [기대] 어두울 땐 불을 켜라고, 밝아진 첫 순간엔 화면이 바뀌어 "멈춰 주세요", 그다음엔 "좋아요, 그대로 찍으세요"로 안내한다.
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

// [상황] 촬영 화면에서 인터넷이 끊겼다가 다시 연결된다.
// [기대] 끊기면 찍은 사진은 남아 있다는 "인터넷 연결이 끊겼습니다" 경고가 뜨고, 다시 연결되면 사라진다.
test("촬영 중 인터넷이 끊기면 찍은 사진은 남아 있다고 알리고, 다시 연결되면 안내를 지운다", async () => {
  asCustomer();
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  await screen.findByRole("button", { name: /^윗면/ });
  act(() => void window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("alert")).toHaveTextContent(/인터넷 연결이 끊겼습니다/);
  act(() => void window.dispatchEvent(new Event("online")));
  expect(screen.queryByText(/인터넷 연결이 끊겼습니다/)).not.toBeInTheDocument();
});

// [상황] 고객이 카메라 권한을 거부했다가 "다시 시도"를 누른다.
// [기대] 카메라 권한이 필요하다는 이유와 iPhone(Safari)·Android(Chrome)에서 다시 허용하는 방법이 보이고, 다시 시도하면 카메라를 다시 연다.
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

// [상황] QR 토큰도 촬영 권한도 없이 촬영 화면을 연다(새로 고침으로 메모리가 비었을 때와 같음).
// [기대] "촬영 정보가 없습니다"와 새 QR을 받으라는 안내가 보인다(촬영 권한은 메모리에만 두므로).
test("새로 고쳐 촬영 정보를 잃으면 새 QR을 받으라고 안내하고, 촬영 화면에는 새로 고치지 말라는 안내가 늘 보인다", async () => {
  asCustomer();
  renderApp("/capture");
  expect(await screen.findByText(/촬영 정보가 없습니다/)).toBeInTheDocument();
});

// [상황] 촬영 권한이 4분 남았다.
// [기대] "촬영 시간이 4분 남았습니다. 서둘러 제출해 주세요."와 새로 고치거나 창을 닫지 말라는 안내가 보인다.
test("촬영 시간이 5분 아래로 남으면 남은 시간을 알린다", async () => {
  asCustomer();
  captureTokenStore.set({ accessToken: "cap.x", tokenType: "Bearer", expiresIn: 4 * 60, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderApp("/capture");
  expect(await screen.findByText("촬영 시간이 4분 남았습니다. 서둘러 제출해 주세요.")).toBeInTheDocument();
  expect(screen.getByText(/새로 고치거나 창을 닫지 마세요/)).toBeInTheDocument();
});

// [상황] 같은 QR 토큰을 촬영 권한으로 바꾸는 요청을 동시에 두 번 부른다(화면이 두 번 그려지는 경우 등).
// [기대] 서버엔 한 번만 가고 두 호출이 같은 결과를 받는다(일회용 QR이 두 번째 요청에서 실패하지 않게).
test("같은 QR 토큰으로 교환을 두 번 불러도 요청은 한 번만 가 두 번째가 실패하지 않는다", async () => {
  const link = mockCaptureLink();
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: MOCK_CUSTOMER })));
  const [a, b] = await Promise.all([exchangeOnce(link.token), exchangeOnce(link.token)]);
  expect(a).toBe(b);
  expect(link.used).toBe(true);
});

// [상황] 촬영 권한이 이미 만료됐다.
// [기대] 면 목록과 찍기 버튼을 숨기고 "촬영 시간이 지났습니다" 안내만 보인다.
test("촬영 시간이 지나면 면 목록과 찍기 버튼을 숨기고 새 QR 안내만 보인다", async () => {
  asCustomer();
  captureTokenStore.set({ accessToken: "cap.x", tokenType: "Bearer", expiresIn: 0, rentalId: "r".repeat(21), checkpointId: "c".repeat(21) });
  renderApp("/capture");
  expect(await screen.findByText(/촬영 시간이 지났습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /윗면/ })).not.toBeInTheDocument();
});

// [상황] QR 토큰 교환을 마친 뒤 같은 토큰으로 다시 교환한다.
// [기대] 이전 결과를 재사용하지 않고 서버의 410(이미 사용됨)을 그대로 받는다.
test("교환이 끝난 QR 토큰은 기억하지 않아, 다시 부르면 서버의 410을 그대로 받는다", async () => {
  const link = mockCaptureLink();
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: MOCK_CUSTOMER })));
  await exchangeOnce(link.token);
  await expect(exchangeOnce(link.token)).rejects.toMatchObject({ status: 410 });
});

// [상황] 흔들린 사진을 찍고 "다시 찍기"를 누른다.
// [기대] 버린 사진의 미리보기용 임시 주소를 해제한다(폰 메모리를 아끼려고).
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

// [상황] QR 교환 응답을 기다리는 사이 로그아웃(촬영 정보 지움)하고 다시 교환을 부른다.
// [기대] 앞 요청과 별개의 새 요청이 되고, 늦게 온 앞 계정의 촬영 권한은 저장하지 않는다.
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

// [상황] 사진을 찍고 "이 사진 쓰기"를 누르지 않은 채 면 목록으로 돌아간다.
// [기대] 쓰지 않은 사진의 미리보기 임시 주소를 한 번 해제한다.
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

// [상황] "찍기"를 누르고 사진이 만들어지기 전에 면 목록으로 돌아갔고, 그 뒤에 사진이 늦게 만들어진다.
// [기대] 늦게 만들어진 사진의 미리보기 임시 주소도 해제한다.
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

// [상황] 카메라 영상이 아직 준비되지 않았다(크기를 모름).
// [기대] "찍기" 버튼이 없다가, 준비되면 나타난다(빈 사진을 찍지 않게).
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

// [상황] 내 렌탈의 기종 크기를 200×200mm로 바꿔 두고 윗면 촬영을 연다. 이어서 기종을 모르는 렌탈로도 연다.
// [기대] 화면의 맞춤 윤곽선이 정사각형(60×60)으로 그려진다. 기종을 모르면 기본 크기(304.1×215mm) 비율(가로 80)로 그린다.
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

// [상황] 기종 크기를 받는 응답이 늦고, 결국 503 오류로 온다.
// [기대] 받는 동안엔 "기종 치수를 불러오는 중"이 보이고 면을 고를 수 없다. 응답이 오면(실패해도) 안내가 사라지고 찍을 수 있다.
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

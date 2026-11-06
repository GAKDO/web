import { screen, within } from "@testing-library/react";
import { nanoid } from "nanoid";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { db } from "../mocks/db";
import { customerHome } from "./customerHome";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/node";

// 보관 기능(VITE_ARCHIVED_FEATURES)은 코드를 그대로 두고 메뉴·링크만 숨긴다(11/3 방향 전환)

afterEach(() => vi.unstubAllEnvs());

/** 출고 봉인 뒤 수령이 촬영 대기(OPEN)인 렌탈을 넣고 상세를 연다 */
async function openRentalWithOpenReceipt() {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const now = new Date().toISOString();
  db.rentals.push({
    rentalId,
    deviceId: device?.deviceId ?? "",
    renterRef: "R-3001",
    status: "OPEN",
    startedAt: now,
    endedAt: null,
    createdAt: now,
    checkpoints: [
      { checkpointId: nanoid(), type: "OUT", status: "SEALED", occurredAt: now },
      { checkpointId: nanoid(), type: "RCV", status: "OPEN", occurredAt: null },
    ],
  });
  renderAsAdmin(`/admin/rentals/${rentalId}`);
  return screen.findByRole("listitem", { name: "수령" });
}

test("보관 설정이 없으면 렌탈 상세에 수령 QR·페어링 코드·리포트 보기가 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByRole("button", { name: /QR/ })).toBeInTheDocument();
  expect(within(receipt).getByRole("button", { name: /페어링/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "리포트 보기" })).toBeInTheDocument();
});

test("폰 촬영·진단·리포트를 보관하면 렌탈 상세에서 수령 QR·페어링 코드·리포트 보기가 사라지고 시점 진행은 그대로다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).queryByRole("button", { name: /QR/ })).not.toBeInTheDocument();
  expect(within(receipt).queryByRole("button", { name: /페어링/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "리포트 보기" })).not.toBeInTheDocument();
  expect(within(receipt).getByText("촬영 대기")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "새로 고침" })).toBeInTheDocument();
});

test("수령·반납 시점을 보관하면 렌탈 상세에 출고만 보이고 수령·반납 시작과 렌탈 종료 버튼이 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "laterCheckpoints");
  const rental = db.rentals.find((r) => r.checkpoints.length === 0);
  renderAsAdmin(`/admin/rentals/${rental?.rentalId}`);
  expect(await screen.findByRole("button", { name: "출고 시작" })).toBeEnabled();
  expect(screen.queryByRole("listitem", { name: "수령" })).not.toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "반납" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "렌탈 종료" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "새로 고침" })).toBeInTheDocument();
});

test("수령·반납 시점을 보관해도 이미 시작한 수령 시점은 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "laterCheckpoints");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByText("촬영 대기")).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "반납" })).not.toBeInTheDocument();
});

test("폰 촬영만 보관한 시연 배포(11/6)에서는 수령이 열려 있으면 부스 빠른 검사로 찍으라는 안내가 보이고 반납 단계도 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,account,pilot");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByText(/부스 빠른 검사 목록에서/)).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "반납" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeInTheDocument();
});

test("리포트를 보관하면 고객 내 렌탈 목록에서도 리포트 보기 링크가 사라지고 렌탈 카드는 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  renderAsCustomer("/my/rentals");
  expect((await screen.findAllByRole("listitem")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "리포트 보기" })).not.toBeInTheDocument();
});

test("가입·재설정을 보관하면 고객 로그인 화면에 회원가입·비밀번호 재설정 링크가 없고 로그인은 그대로 된다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "account");
  renderApp("/login");
  await screen.findByRole("button", { name: "로그인" });
  expect(screen.queryByRole("link", { name: "회원가입" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "비밀번호를 잊으셨나요?" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("이메일")).toBeInTheDocument();
});

test("파일럿 추이를 보관하면 Grafana 주소가 있어도 관리 메뉴에 보이지 않는다", async () => {
  vi.stubEnv("VITE_PILOT_DASHBOARD_URL", "https://grafana.example/d/trace-pilot-trend");
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "pilot");
  renderAsAdmin("/admin/devices");
  await screen.findByRole("link", { name: "기기" });
  expect(screen.queryByRole("link", { name: /파일럿 추이/ })).not.toBeInTheDocument();
});

const MVP_ARCHIVED = "phoneCapture,diagnostics,report,account,pilot";

test.each(["/signup", "/signup/verify", "/login", "/capture", "/my/rentals", "/my/rentals/abc", "/verify/abc", "/password/reset"])(
  "MVP 배포에서 숨긴 화면 주소 %s를 직접 치면 첫 화면으로 돌아간다",
  async (path) => {
    vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
    const { router } = renderApp(path);
    await screen.findByRole("link", { name: /관리자 화면 열기/ });
    expect(router.state.location.pathname).toBe("/");
  },
);

test("보관하지 않으면 숨긴 화면 주소도 그대로 열린다(개발·재도입)", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const { router } = renderApp("/signup");
  await screen.findByRole("heading", { level: 1 });
  expect(router.state.location.pathname).toBe("/signup");
});

test("MVP 배포에서도 관리자 화면 주소는 그대로 열린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
  const { router } = renderAsAdmin("/admin/inspections");
  await screen.findByRole("heading", { name: "검사 결과" });
  expect(router.state.location.pathname).toBe("/admin/inspections");
});

test("리포트만 숨기면 로그인하지 않은 사람이 내 렌탈 주소를 쳐도 로그인 화면이 아니라 첫 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  const { router } = renderApp("/my/rentals");
  await screen.findByRole("link", { name: /관리자 화면 열기/ });
  expect(router.state.location.pathname).toBe("/");
});

test("계정 기능을 다시 켜면 폰 촬영·리포트가 숨겨져 있어도 고객 로그인 화면이 열린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,report");
  const { router } = renderApp("/login");
  await screen.findByRole("heading", { level: 1 });
  expect(router.state.location.pathname).toBe("/login");
});

test("계정 기능을 보이고 리포트는 숨긴 배포에서는 첫 화면에 고객 로그인·회원가입이 있고, 가입·인증 뒤 내 계정 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  renderApp("/");
  expect(await screen.findByRole("link", { name: "고객 로그인" })).toHaveAttribute("href", "/login");
  expect(screen.getByRole("link", { name: "고객 회원가입" })).toHaveAttribute("href", "/signup");
  expect(customerHome()).toBe("/my/account");
});

test("MVP 배포(계정 숨김)에서는 첫 화면에 고객 로그인·회원가입이 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
  renderApp("/");
  await screen.findByRole("link", { name: /관리자 화면 열기/ });
  expect(screen.queryByRole("link", { name: "고객 로그인" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "고객 회원가입" })).not.toBeInTheDocument();
});

test("리포트를 숨긴 배포에서 고객은 내 계정 화면에서 탈퇴로 갈 수 있고 내 렌탈 링크는 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  renderAsCustomer("/my/account");
  expect(await screen.findByRole("heading", { name: "내 계정" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "계정 탈퇴" })).toHaveAttribute("href", "/my/account/withdraw");
  expect(screen.queryByRole("link", { name: "내 렌탈" })).not.toBeInTheDocument();
});

test("내 계정에서 로그아웃할 때 서버가 확인하지 못하면 로그인 화면에서 알린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  server.use(http.post("*/api/v1/auth/logout", () => HttpResponse.error()));
  const user = userEvent.setup();
  renderAsCustomer("/my/account");
  await user.click(await screen.findByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("서버에 알리지 못했습니다");
});

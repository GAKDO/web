// 이 파일이 확인하는 것: 기능 보관(숨김) 설정 VITE_ARCHIVED_FEATURES. 11/3 방향 전환으로 MVP에서 뺀 기능은 코드를 지우지 않고
// 메뉴·버튼·주소만 숨긴다. 설정 값에 적은 기능(phoneCapture=폰 촬영, diagnostics=진단, report=리포트, account=고객 계정,
// pilot=파일럿 추이, laterCheckpoints=수령·반납 시점)만 사라지고 나머지는 그대로 돌아가는지 본다.

import { screen, within } from "@testing-library/react";
import { nanoid } from "nanoid";
import { renderApp, renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { db } from "../mocks/db";
import { customerHome } from "./customerHome";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/node";

// 보관 기능(VITE_ARCHIVED_FEATURES)은 코드를 그대로 두고 메뉴·링크만 숨긴다(11/3 방향 전환)

// 테스트 도구: 테스트마다 바꾼 배포 설정을 되돌린다.
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

// [상황] 아무것도 숨기지 않은 설정에서, 출고 봉인·수령 촬영 대기인 렌탈 상세를 연다.
// [기대] 수령 QR 버튼, 진단 페어링 버튼, 리포트 자리(여기선 "리포트 기록이 아직 없습니다")가 모두 보인다.
test("보관 설정이 없으면 렌탈 상세에 수령 QR·페어링 코드·리포트 자리가 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByRole("button", { name: /QR/ })).toBeInTheDocument();
  // 페어링 버튼은 진단 조회가 끝난 뒤 나타나므로 기다린다(느린 CI에서 먼저 물으면 아직 없다)
  expect(await within(receipt).findByRole("button", { name: /페어링/ })).toBeInTheDocument();
  // 이 렌탈은 리포트 목에 기록이 없어(404) 링크 대신 "기록 없음" 안내가 보인다(보관하면 둘 다 사라진다)
  // ※ 응답 코드: 404 = 찾을 수 없음(없는 주소나 데이터)
  expect(await screen.findByText("리포트 기록이 아직 없습니다")).toBeInTheDocument();
});

// [상황] 폰 촬영·진단·리포트를 숨기고 같은 렌탈 상세를 연다.
// [기대] 수령 QR·페어링·리포트 보기가 사라지고, 시점 진행("촬영 대기", 새로 고침)은 그대로다.
test("폰 촬영·진단·리포트를 보관하면 렌탈 상세에서 수령 QR·페어링 코드·리포트 보기가 사라지고 시점 진행은 그대로다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).queryByRole("button", { name: /QR/ })).not.toBeInTheDocument();
  expect(within(receipt).queryByRole("button", { name: /페어링/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "리포트 보기" })).not.toBeInTheDocument();
  expect(within(receipt).getByText("촬영 대기")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "새로 고침" })).toBeInTheDocument();
});

// [상황] 수령·반납 시점을 숨기고 시점 없는 렌탈 상세를 연다.
// [기대] 출고만 보이고 수령·반납 칸과 렌탈 종료 버튼이 없다.
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

// [상황] 수령·반납 시점을 숨겼지만, 이미 수령을 시작한 렌탈을 연다.
// [기대] 시작된 수령 칸은 그대로 보이고, 반납 칸만 없다(진행 중인 기록을 감추지 않음).
test("수령·반납 시점을 보관해도 이미 시작한 수령 시점은 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "laterCheckpoints");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByText("촬영 대기")).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "반납" })).not.toBeInTheDocument();
});

// [상황] 11/6 시연 배포 설정(폰 촬영·진단·리포트·계정·파일럿 숨김)에서 수령이 열린 렌탈을 연다.
// [기대] 수령은 부스 빠른 검사 목록에서 찍으라는 안내가 보이고, 반납 칸과 렌탈 종료 버튼도 보인다.
test("폰 촬영만 보관한 시연 배포(11/6)에서는 수령이 열려 있으면 부스 빠른 검사로 찍으라는 안내가 보이고 반납 단계도 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,account,pilot");
  const receipt = await openRentalWithOpenReceipt();
  expect(within(receipt).getByText(/부스 빠른 검사 목록에서/)).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "반납" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "렌탈 종료" })).toBeInTheDocument();
});

// [상황] 리포트를 숨기고 고객이 내 렌탈을 연다.
// [기대] 렌탈 카드는 보이지만 "리포트 보기" 링크는 없다.
test("리포트를 보관하면 고객 내 렌탈 목록에서도 리포트 보기 링크가 사라지고 렌탈 카드는 그대로 보인다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  renderAsCustomer("/my/rentals");
  expect((await screen.findAllByRole("listitem")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "리포트 보기" })).not.toBeInTheDocument();
});

// [상황] 고객 계정(가입·재설정)을 숨기고 로그인 화면을 연다.
// [기대] 회원가입·비밀번호 재설정 링크가 없고, 로그인 칸은 그대로 있다.
test("가입·재설정을 보관하면 고객 로그인 화면에 회원가입·비밀번호 재설정 링크가 없고 로그인은 그대로 된다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "account");
  renderApp("/login");
  await screen.findByRole("button", { name: "로그인" });
  expect(screen.queryByRole("link", { name: "회원가입" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "비밀번호를 잊으셨나요?" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("이메일")).toBeInTheDocument();
});

// [상황] 파일럿을 숨기고, Grafana 대시보드 주소는 설정돼 있다.
// [기대] 관리 메뉴에 "파일럿 추이"가 보이지 않는다.
test("파일럿 추이를 보관하면 Grafana 주소가 있어도 관리 메뉴에 보이지 않는다", async () => {
  vi.stubEnv("VITE_PILOT_DASHBOARD_URL", "https://grafana.example/d/trace-pilot-trend");
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "pilot");
  renderAsAdmin("/admin/devices");
  await screen.findByRole("link", { name: "기기" });
  expect(screen.queryByRole("link", { name: /파일럿 추이/ })).not.toBeInTheDocument();
});

// 테스트 도구: MVP 배포에서 숨기는 기능 묶음(폰 촬영·진단·리포트·고객 계정·파일럿).
const MVP_ARCHIVED = "phoneCapture,diagnostics,report,account,pilot";

// [상황] MVP 배포 설정에서 숨긴 화면 주소(가입·로그인·촬영·내 렌탈·검증·재설정)를 하나씩 직접 쳐서 연다.
// [기대] 모두 첫 화면(/)으로 돌아간다.
test.each(["/signup", "/signup/verify", "/login", "/capture", "/my/rentals", "/my/rentals/abc", "/verify/abc", "/password/reset"])(
  "MVP 배포에서 숨긴 화면 주소 %s를 직접 치면 첫 화면으로 돌아간다",
  async (path) => {
    vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
    const { router } = renderApp(path);
    await screen.findByRole("link", { name: /관리자 화면 열기/ });
    expect(router.state.location.pathname).toBe("/");
  },
);

// [상황] 아무것도 숨기지 않고 가입 주소를 연다.
// [기대] 가입 화면이 그대로 열린다(개발하거나 기능을 다시 들일 때).
test("보관하지 않으면 숨긴 화면 주소도 그대로 열린다(개발·재도입)", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "");
  const { router } = renderApp("/signup");
  await screen.findByRole("heading", { level: 1 });
  expect(router.state.location.pathname).toBe("/signup");
});

// [상황] MVP 배포 설정에서 관리자로 검사 결과 화면을 연다.
// [기대] 그대로 열린다.
test("MVP 배포에서도 관리자 화면 주소는 그대로 열린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
  const { router } = renderAsAdmin("/admin/inspections");
  await screen.findByRole("heading", { name: "검사 결과" });
  expect(router.state.location.pathname).toBe("/admin/inspections");
});

// [상황] 리포트만 숨기고, 로그인하지 않은 사람이 내 렌탈 주소를 친다.
// [기대] 로그인 화면이 아니라 첫 화면으로 간다(어차피 볼 수 없는 화면에 로그인시키지 않음).
test("리포트만 숨기면 로그인하지 않은 사람이 내 렌탈 주소를 쳐도 로그인 화면이 아니라 첫 화면으로 간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "report");
  const { router } = renderApp("/my/rentals");
  await screen.findByRole("link", { name: /회원가입하고 시작하기/ });
  expect(router.state.location.pathname).toBe("/");
});

// [상황] 폰 촬영·리포트는 숨겼지만 계정 기능은 켜고 로그인 주소를 연다.
// [기대] 고객 로그인 화면이 열린다.
test("계정 기능을 다시 켜면 폰 촬영·리포트가 숨겨져 있어도 고객 로그인 화면이 열린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,report");
  const { router } = renderApp("/login");
  await screen.findByRole("heading", { level: 1 });
  expect(router.state.location.pathname).toBe("/login");
});

// [상황] 계정 기능을 켠 배포에서 첫 화면을 연다.
// [기대] 회원가입·로그인 링크가 먼저 있고, "관리자 화면 열기" 큰 버튼은 없으며, 관리자 로그인은 맨 아래 작은 링크로만 있다.
//        고객이 로그인 뒤 갈 기본 화면은 내 계정(/my/account)이다.
test("계정 기능을 보이면 첫 화면은 회원가입·로그인이 먼저이고, 관리자 로그인은 맨 아래 작은 링크로만 있다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  renderApp("/");
  expect(await screen.findByRole("link", { name: /회원가입하고 시작하기/ })).toHaveAttribute("href", "/signup");
  expect(screen.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/signup");
  for (const link of screen.getAllByRole("link", { name: "로그인" })) expect(link).toHaveAttribute("href", "/login");
  expect(screen.queryByRole("link", { name: /관리자 화면 열기/ })).not.toBeInTheDocument();
  expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: "관리자 로그인" })).toHaveAttribute("href", "/admin/login");
  expect(customerHome()).toBe("/my/account");
});

// [상황] MVP 배포 설정에서 첫 화면을 연다.
// [기대] "관리자 화면 열기"만 있고 회원가입 링크는 없다.
test("MVP 배포(계정 숨김)에서는 첫 화면에 고객 로그인·회원가입이 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", MVP_ARCHIVED);
  renderApp("/");
  await screen.findByRole("link", { name: /관리자 화면 열기/ });
  expect(screen.queryByRole("link", { name: "회원가입" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /회원가입하고 시작하기/ })).not.toBeInTheDocument();
});

// [상황] 리포트를 숨긴 배포에서 고객이 내 계정 화면을 연다.
// [기대] "내 정보"와 "탈퇴하기" 링크가 보이고, 마이페이지(내 렌탈) 링크는 없다.
test("리포트를 숨긴 배포에서 고객은 내 계정 화면에서 탈퇴로 갈 수 있고 내 렌탈 링크는 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  renderAsCustomer("/my/account");
  expect(await screen.findByRole("heading", { name: "내 정보" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "탈퇴하기" })).toHaveAttribute("href", "/my/account/withdraw");
  expect(screen.queryByRole("link", { name: "마이페이지" })).not.toBeInTheDocument();
});

// [상황] 고객이 내 계정 화면의 "로그아웃"을 눌렀는데, 서버에 닿지 못한다(네트워크 오류).
// [기대] 로그인 화면에서 "서버에 알리지 못했습니다" 경고를 보인다.
test("내 계정에서 로그아웃할 때 서버가 확인하지 못하면 로그인 화면에서 알린다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,report,pilot");
  server.use(http.post("*/api/v1/auth/logout", () => HttpResponse.error()));
  const user = userEvent.setup();
  renderAsCustomer("/my/account");
  // 헤더에도 로그아웃이 있으므로(11/12) 내 계정 화면 안의 버튼을 누른다
  await user.click(await within(await screen.findByRole("main")).findByRole("button", { name: "로그아웃" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("서버에 알리지 못했습니다");
});

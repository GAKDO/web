import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp, renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

beforeEach(() => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("로그인하지 않은 사람도 이용 안내에서 가입부터 반납 비교까지 여섯 단계와 단계마다 누가 무엇을 하는지 본다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "diagnostics,pilot");
  renderApp("/guide");
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  const steps = within(screen.getByRole("list", { name: "대여 순서" })).getAllByRole("listitem").filter((li) => li.parentElement?.getAttribute("aria-label") === "대여 순서");
  expect(steps.map((li) => within(li).getByRole("heading", { level: 3 }).textContent)).toEqual([
    "1단계 미리 가입하기",
    "2단계 창구에서 대여",
    "3단계 출고 검사",
    "4단계 수령: QR 하나로 연결과 촬영",
    "5단계 쓰는 동안",
    "6단계 반납 비교",
  ]);
  const receive = within(screen.getByRole("list", { name: "수령: QR 하나로 연결과 촬영에서 하는 일" }));
  expect(receive.getByText(/로그인\(또는 인증\)이 끝나는 순간 그 렌탈을 내 계정에 연결/)).toBeInTheDocument();
  expect(receive.getByText(/폰으로 찍어 제출합니다/)).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "출고 검사에서 하는 일" })).getByText(/실제 흠집만 확정/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /회원가입하기/ })).toHaveAttribute("href", "/signup");
});

test("이용 안내의 판정 기준은 A~D 등급마다 흠집 개수·길이 규칙을 보이고, 봉인 기록 확인 순서를 세 단계로 알려 준다", async () => {
  renderApp("/guide");
  const table = await screen.findByRole("table", { name: "등급 기준" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["A", "B", "C", "D"]);
  expect(within(rows[3]).getByText(/균열이 하나라도 있거나 찍힘이 3개 이상/)).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "봉인 기록 확인 순서" })).getAllByRole("heading").map((h) => h.textContent)).toEqual(["메일 지문 확인", "검증 페이지 열기", "지문 비교"]);
});

test("폰 촬영을 숨긴 배포의 이용 안내는 수령 단계에서 폰 촬영 없이 QR 로그인으로 렌탈 연결만 안내한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
  renderApp("/guide");
  const receive = within(await screen.findByRole("list", { name: "수령: QR 하나로 계정 연결에서 하는 일" }));
  expect(receive.getByText(/렌탈을 내 계정에 연결합니다/)).toBeInTheDocument();
  expect(receive.queryByText(/폰으로 찍어 제출합니다/)).not.toBeInTheDocument();
});

test("첫 화면 아래쪽에서 '이용 안내 자세히 보기'를 누르면 이용 안내가 맨 위(빌리는 방법)부터 열린다", async () => {
  const u = userEvent.setup();
  const scrollTo = vi.spyOn(window, "scrollTo");
  renderApp("/");
  const more = await screen.findByRole("link", { name: "이용 안내 자세히 보기" });
  scrollTo.mockClear();
  await u.click(more);
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  scrollTo.mockRestore();
});

test("이용 안내 목차의 '판정 기준'을 누르면 판정 기준 구역으로 내려간다", async () => {
  const u = userEvent.setup();
  renderApp("/guide");
  const grade = await screen.findByRole("heading", { level: 2, name: "상태는 이렇게 판정해요" });
  const section = grade.closest("section")!;
  const into = vi.spyOn(section, "scrollIntoView");
  await u.click(within(screen.getByRole("navigation", { name: "이 페이지 목차" })).getByRole("link", { name: "판정 기준" }));
  expect(into).toHaveBeenCalled();
});

test("첫 화면의 판정 기준·자주 묻는 질문 아래 링크는 이용 안내의 해당 구역으로 간다", async () => {
  renderApp("/");
  expect(await screen.findByRole("link", { name: "등급별 자세한 기준 보기" })).toHaveAttribute("href", "/guide#grade");
  expect(screen.getByRole("link", { name: "질문 더 보기" })).toHaveAttribute("href", "/guide#faq");
});

test("첫 화면의 '빌리는 방법 보기'를 누르면 이용 안내가 열린다", async () => {
  const u = userEvent.setup();
  renderApp("/");
  await u.click(await screen.findByRole("link", { name: "빌리는 방법 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
});

test("렌탈이 없는 고객은 내 렌탈에서 이용 안내로 갈 수 있고, 안내에서 내 렌탈로 돌아온다", async () => {
  const u = userEvent.setup();
  db.report.owners.clear();
  renderAsCustomer("/my/rentals");
  await u.click(await screen.findByRole("link", { name: "이용 안내 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  await u.click(screen.getByRole("link", { name: /마이페이지 열기/ }));
  expect(await screen.findByRole("heading", { level: 1, name: "마이페이지" })).toBeInTheDocument();
});

test("리포트(report)를 숨긴 배포에서는 이용 안내 주소가 첫 화면으로 돌아간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,report,diagnostics,pilot");
  renderApp("/guide");
  expect(await screen.findByRole("link", { name: "회원가입하고 시작하기" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "빌리는 방법 보기" })).not.toBeInTheDocument();
});

test("고객 계정이 보이는 배포의 첫 화면에는 장점·이용 4단계·마이페이지·판정 기준·자주 묻는 질문·가입 유도가 있다", async () => {
  renderApp("/");
  for (const name of ["빌릴 때도, 돌려줄 때도 마음 편하게", "대여부터 반납까지 4단계", "가입하면 이런 걸 볼 수 있어요", "판정 기준", "자주 묻는 질문", "지금 가입하고 렌탈을 연결하세요"]) {
    expect(await screen.findByRole("heading", { level: 2, name })).toBeInTheDocument();
  }
  expect(screen.getByRole("navigation", { name: "바로 가기" })).toBeInTheDocument();
});

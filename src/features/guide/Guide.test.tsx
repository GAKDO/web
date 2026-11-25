// 이 파일이 확인하는 것: 누구나 보는 이용 안내 화면(/guide)과 첫 화면의 안내 구역.
// 노트북을 빌리는 순서, 등급 기준, 봉인 기록 확인 방법을 보여 주고, 배포에서 숨긴 기능에 맞춰 안내 문장도 바뀐다.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderApp, renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// 테스트 도구: 기본 배포 설정은 폰 촬영·진단·파일럿을 숨긴 상태로 두고, 테스트가 끝나면 되돌린다.
beforeEach(() => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// [상황] 폰 촬영까지 켠 배포에서 로그인하지 않고 이용 안내를 연다.
// [기대] 가입 → 창구 대여 → 출고 검사 → 수령(QR로 연결과 촬영) → 쓰는 동안 → 반납 비교, 여섯 단계가 순서대로 보인다.
//        수령 단계엔 로그인하면 렌탈이 내 계정에 연결되고 폰으로 찍어 낸다는 설명이, 출고 단계엔 실제 흠집만 확정한다는 설명이 있고,
//        회원가입 링크가 있다.
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
  expect(receive.getByText(/로그인이 끝나는 순간 그 렌탈을 내 계정에 연결/)).toBeInTheDocument();
  expect(receive.getByText(/폰으로 찍어 제출합니다/)).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "출고 검사에서 하는 일" })).getByText(/실제 흠집만 확정/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /회원가입하기/ })).toHaveAttribute("href", "/signup");
});

// [상황] 이용 안내의 판정 기준 표와 봉인 기록 확인 순서를 본다.
// [기대] A·B·C·D 등급 줄이 있고(D는 균열 1개 이상 또는 찍힘 3개 이상), 확인 순서는 메일 지문 확인 → 검증 페이지 열기 → 지문 비교 세 단계다.
test("이용 안내의 판정 기준은 A~D 등급마다 흠집 개수·길이 규칙을 보이고, 봉인 기록 확인 순서를 세 단계로 알려 준다", async () => {
  renderApp("/guide");
  const table = await screen.findByRole("table", { name: "등급 기준" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["A", "B", "C", "D"]);
  expect(within(rows[3]).getByText(/균열이 하나라도 있거나 찍힘이 3개 이상/)).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "봉인 기록 확인 순서" })).getAllByRole("heading").map((h) => h.textContent)).toEqual(["메일 지문 확인", "검증 페이지 열기", "지문 비교"]);
});

// [상황] 폰 촬영을 숨긴 배포에서 이용 안내를 연다.
// [기대] 수령 단계는 QR 로그인으로 렌탈을 계정에 연결만 한다고 안내하고, 폰 촬영 설명과 관련 질문은 없다.
test("폰 촬영을 숨긴 배포의 이용 안내는 수령 단계에서 폰 촬영 없이 QR 로그인으로 렌탈 연결만 안내한다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,diagnostics,pilot");
  renderApp("/guide");
  const receive = within(await screen.findByRole("list", { name: "수령: QR 하나로 계정 연결에서 하는 일" }));
  expect(receive.getByText(/렌탈을 내 계정에 연결합니다/)).toBeInTheDocument();
  expect(receive.queryByText(/폰으로 찍어 제출합니다/)).not.toBeInTheDocument();
  expect(screen.queryByText("수령 때 꼭 폰으로 찍어야 하나요?")).not.toBeInTheDocument();
});

// [상황] 고객 가입(account)을 숨긴 배포에서 이용 안내를 연다.
// [기대] 가입 단계와 메일 인증 안내가 빠지고, 1단계가 "창구에서 대여"가 된다.
test("고객 가입을 숨긴 배포의 이용 안내에는 가입 단계와 가입·메일 인증 안내가 없다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "account,diagnostics,pilot");
  renderApp("/guide");
  const list = await screen.findByRole("list", { name: "대여 순서" });
  expect(within(list).queryByRole("heading", { name: /미리 가입하기/ })).not.toBeInTheDocument();
  expect(within(list).getByRole("heading", { level: 3, name: /1단계 창구에서 대여/ })).toBeInTheDocument();
  expect(screen.queryByText(/가입하고 메일 인증을 마칩니다/)).not.toBeInTheDocument();
});

// [상황] 첫 화면 아래쪽까지 내려가 "이용 안내 자세히 보기"를 누른다.
// [기대] 이용 안내가 아래쪽이 아니라 맨 위(빌리는 방법)부터 열린다.
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

// [상황] 이용 안내 목차에서 "판정 기준"을 누른다.
// [기대] 판정 기준 구역으로 스크롤해 내려간다.
test("이용 안내 목차의 '판정 기준'을 누르면 판정 기준 구역으로 내려간다", async () => {
  const u = userEvent.setup();
  renderApp("/guide");
  const grade = await screen.findByRole("heading", { level: 2, name: "상태는 이렇게 판정해요" });
  const section = grade.closest("section")!;
  const into = vi.spyOn(section, "scrollIntoView");
  await u.click(within(screen.getByRole("navigation", { name: "이 페이지 목차" })).getByRole("link", { name: "판정 기준" }));
  expect(into).toHaveBeenCalled();
});

// [상황] 첫 화면의 "등급별 자세한 기준 보기", "질문 더 보기" 링크를 본다.
// [기대] 각각 이용 안내의 판정 기준(#grade), 자주 묻는 질문(#faq) 구역으로 간다.
test("첫 화면의 판정 기준·자주 묻는 질문 아래 링크는 이용 안내의 해당 구역으로 간다", async () => {
  renderApp("/");
  expect(await screen.findByRole("link", { name: "등급별 자세한 기준 보기" })).toHaveAttribute("href", "/guide#grade");
  expect(screen.getByRole("link", { name: "질문 더 보기" })).toHaveAttribute("href", "/guide#faq");
});

// [상황] 첫 화면에서 "빌리는 방법 보기"를 누른다.
// [기대] 이용 안내가 열린다.
test("첫 화면의 '빌리는 방법 보기'를 누르면 이용 안내가 열린다", async () => {
  const u = userEvent.setup();
  renderApp("/");
  await u.click(await screen.findByRole("link", { name: "빌리는 방법 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
});

// [상황] 렌탈이 하나도 없는 고객이 내 렌탈 화면에서 "이용 안내 보기"를 누르고, 안내에서 "마이페이지 열기"를 누른다.
// [기대] 이용 안내가 열리고, 다시 마이페이지로 돌아온다.
test("렌탈이 없는 고객은 내 렌탈에서 이용 안내로 갈 수 있고, 안내에서 내 렌탈로 돌아온다", async () => {
  const u = userEvent.setup();
  db.report.owners.clear();
  renderAsCustomer("/my/rentals");
  await u.click(await screen.findByRole("link", { name: "이용 안내 보기" }));
  expect(await screen.findByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).toBeInTheDocument();
  await u.click(screen.getByRole("link", { name: /마이페이지 열기/ }));
  expect(await screen.findByRole("heading", { level: 1, name: "마이페이지" })).toBeInTheDocument();
});

// [상황] 리포트까지 숨긴 배포에서 이용 안내 주소를 연다.
// [기대] 첫 화면으로 돌아가고, 이용 안내 제목과 "빌리는 방법 보기" 링크는 없다.
test("리포트(report)를 숨긴 배포에서는 이용 안내 주소가 첫 화면으로 돌아간다", async () => {
  vi.stubEnv("VITE_ARCHIVED_FEATURES", "phoneCapture,report,diagnostics,pilot");
  renderApp("/guide");
  expect(await screen.findByRole("link", { name: "회원가입하고 시작하기" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "TRACE로 노트북 빌리는 방법" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "빌리는 방법 보기" })).not.toBeInTheDocument();
});

// [상황] 고객 계정이 보이는 배포에서 첫 화면을 연다.
// [기대] 장점, 대여부터 반납까지 4단계, 가입하면 볼 수 있는 것, 판정 기준, 자주 묻는 질문, 가입 유도 구역과 "바로 가기" 메뉴가 있다.
test("고객 계정이 보이는 배포의 첫 화면에는 장점·이용 4단계·마이페이지·판정 기준·자주 묻는 질문·가입 유도가 있다", async () => {
  renderApp("/");
  for (const name of ["빌릴 때도, 돌려줄 때도 마음 편하게", "대여부터 반납까지 4단계", "가입하면 이런 걸 볼 수 있어요", "판정 기준", "자주 묻는 질문", "지금 가입하고 렌탈을 연결하세요"]) {
    expect(await screen.findByRole("heading", { level: 2, name })).toBeInTheDocument();
  }
  expect(screen.getByRole("navigation", { name: "바로 가기" })).toBeInTheDocument();
});

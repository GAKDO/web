// 이 파일이 확인하는 것: 고객 마이페이지의 "내 렌탈" 목록과 렌탈 리포트 화면.
// 리포트는 출고 → 수령 → 반납 시점마다 등급·신규 흠집을 보여 주고, 남의 렌탈은 볼 수 없다.
// 관리자도 렌탈 상세에서 같은 리포트를 열 수 있다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { renderAsAdmin, renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { MY_RENTALS_PAGE_SIZE } from "./api/report";
import { http, HttpResponse } from "msw";
import { server } from "../../shared/mocks/node";

/** 목의 고객 렌탈 ①(출고·수령 봉인, 반납 검사 중) */
function firstRentalId(): string {
  return [...db.report.owners.keys()][0];
}

/** 마이페이지 '내 노트북' 목록의 카드(카드 안 검사 단계 목록은 세지 않는다) */
function deviceCards(): Element[] {
  return [...screen.getByRole("list", { name: "내 노트북" }).children];
}

// 테스트 묶음: 고객이 자기 렌탈을 모아 보는 목록.
describe("내 렌탈 목록", () => {
  // [상황] 렌탈이 2개 있는 고객이 내 렌탈을 연다.
  // [기대] 카드 2장이 기종 이름·렌탈 상태(반납됨 등)·최근 시점(예: "최근 반납 · 검사 중", "최근 출고 · 등급 A")과 함께 보인다.
  test("렌탈이 2개 있는 고객이 로그인하면 내 렌탈 2개가 기종 이름·렌탈 상태·최근 시점과 함께 보인다", async () => {
    renderAsCustomer("/my/rentals");
    const card = await screen.findByRole("listitem", { name: "MacBook Pro 14 (M3, 2023)" });
    expect(within(card).getByText("반납됨")).toBeInTheDocument();
    expect(await within(card).findByText(/최근 반납 · 검사 중/)).toBeInTheDocument();
    const other = screen.getByRole("listitem", { name: "LG gram 16 (2024)" });
    expect(await within(other).findByText(/최근 출고 · 등급 A/)).toBeInTheDocument();
    expect(deviceCards()).toHaveLength(2);
  });

  // [상황] 렌탈이 한 쪽에 보이는 수보다 2개 많다. "더 보기"를 누른다.
  // [기대] 처음엔 한 쪽만 보이고, 누르면 나머지 2개가 이어서 붙으며 더 볼 것이 없으면 버튼이 사라진다.
  test("렌탈이 한 쪽보다 많으면 더 보기로 나머지 렌탈을 불러온다", async () => {
    const u = userEvent.setup();
    const base = db.rentals.find((r) => r.rentalId === firstRentalId());
    if (!base) throw new Error("목 렌탈 없음");
    const owner = db.report.owners.get(base.rentalId) ?? "";
    for (let i = 0; i < MY_RENTALS_PAGE_SIZE; i += 1) {
      const rentalId = nanoid();
      db.rentals.unshift({ ...base, rentalId });
      db.report.owners.set(rentalId, owner);
    }
    renderAsCustomer("/my/rentals");
    await screen.findByRole("list", { name: "내 노트북" });
    expect(deviceCards()).toHaveLength(MY_RENTALS_PAGE_SIZE);
    await u.click(screen.getByRole("button", { name: "더 보기" }));
    await waitFor(() => expect(deviceCards()).toHaveLength(MY_RENTALS_PAGE_SIZE + 2));
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  // [상황] 렌탈이 하나도 없는 고객이 내 렌탈을 연다.
  // [기대] "아직 연결된 렌탈이 없습니다"가 보인다.
  test("렌탈이 없는 고객이 목록을 열면 '아직 연결된 렌탈이 없습니다'가 보인다", async () => {
    db.report.owners.clear();
    renderAsCustomer("/my/rentals");
    expect(await screen.findByText(/아직 연결된 렌탈이 없습니다/)).toBeInTheDocument();
  });

  // [상황] 내 렌탈에서 카드의 "리포트 보기"를 누른다.
  // [기대] 리포트에 출고·수령·반납 시점이 순서대로 보이고, 수령은 "등급 B"·"신규 흠집 1개", 반납은 "검사 중"이다.
  test("렌탈 하나를 누르면 리포트가 열리고 출고·수령·반납 시점이 순서대로 보인다", async () => {
    const u = userEvent.setup();
    renderAsCustomer("/my/rentals");
    const card = await screen.findByRole("listitem", { name: "MacBook Pro 14 (M3, 2023)" });
    await u.click(within(card).getByRole("link", { name: "리포트 보기" }));
    const steps = await screen.findByRole("list", { name: "시점" });
    expect(within(steps).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["출고", "수령", "반납"]);
    const rcv = within(steps).getByRole("listitem", { name: "수령" });
    expect(within(rcv).getByText("등급 B")).toBeInTheDocument();
    expect(within(rcv).getByText("신규 흠집 1개")).toBeInTheDocument();
    expect(within(within(steps).getByRole("listitem", { name: "반납" })).getByText("검사 중")).toBeInTheDocument();
  });
});

// 테스트 묶음: 렌탈 하나의 리포트 화면과 권한·오류 처리.
describe("리포트", () => {
  // [상황] 아직 수령하지 않은 렌탈의 리포트를 연다.
  // [기대] 수령 시점이 "아직 진행 전"으로 보인다.
  test("아직 오지 않은 시점은 '아직 진행 전'으로 보인다", async () => {
    const second = [...db.report.owners.keys()][1];
    renderAsCustomer(`/my/rentals/${second}`);
    const steps = await screen.findByRole("list", { name: "시점" });
    expect(within(within(steps).getByRole("listitem", { name: "수령" })).getByText("아직 진행 전")).toBeInTheDocument();
  });

  // [상황] 다른 고객의 렌탈 주소를 직접 입력해 연다.
  // [기대] "이 렌탈을 볼 권한이 없습니다."와 "내 렌탈 목록으로" 버튼만 보이고, 시점 내용은 전혀 보이지 않는다.
  test("다른 고객의 렌탈 주소를 직접 열면 '이 렌탈을 볼 권한이 없습니다'와 내 렌탈 목록으로 가는 버튼이 보인다", async () => {
    const rentalId = firstRentalId();
    db.report.owners.set(rentalId, nanoid());
    renderAsCustomer(`/my/rentals/${rentalId}`);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("이 렌탈을 볼 권한이 없습니다.");
    expect(within(alert).getByRole("link", { name: "내 렌탈 목록으로" })).toHaveAttribute("href", "/my/rentals");
    expect(screen.queryByRole("list", { name: "시점" })).not.toBeInTheDocument();
  });

  // [상황] 없는 렌탈 번호로 리포트를 연다.
  // [기대] "렌탈을 찾을 수 없습니다."가 보인다.
  test("없는 렌탈 주소를 열면 '렌탈을 찾을 수 없습니다'가 보인다", async () => {
    renderAsCustomer(`/my/rentals/${nanoid()}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("렌탈을 찾을 수 없습니다.");
  });

  // [상황] 서버가 이 렌탈의 기록 이어짐(해시 체인)이 끊겼다고 알린다.
  // [기대] 리포트 맨 위에 "기록이 바뀌었을 수 있습니다" 경고가 보인다.
  test("기록 체인이 정상이 아니면 리포트 맨 위에 '기록이 바뀌었을 수 있습니다' 경고가 보인다", async () => {
    const rentalId = firstRentalId();
    const timeline = db.report.timelines.get(rentalId);
    if (timeline) timeline.chainStatus = "BROKEN";
    renderAsCustomer(`/my/rentals/${rentalId}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("기록이 바뀌었을 수 있습니다");
  });

  // [상황] 관리자가 렌탈 상세에서 "리포트 보기"를 누른다.
  // [기대] 같은 리포트가 열리고, 돌아가기 링크는 마이페이지가 아니라 그 렌탈 상세로 간다.
  test("관리자 렌탈 상세의 '리포트 보기'로 같은 리포트를 연다", async () => {
    const u = userEvent.setup();
    renderAsAdmin(`/admin/rentals/${firstRentalId()}`);
    await u.click(await screen.findByRole("link", { name: "리포트 보기" }));
    expect(await screen.findByRole("list", { name: "시점" })).toBeInTheDocument();
    // 관리자는 마이페이지가 아니라 렌탈 상세로 돌아간다
    expect(screen.getByRole("link", { name: "렌탈 상세" })).toHaveAttribute("href", `/admin/rentals/${firstRentalId()}`);
  });

  // [상황] 리포트 서버에 아직 기록이 없는 렌탈의 관리자 상세를 연다.
  // [기대] "리포트 보기" 대신 "리포트 기록이 아직 없습니다"가 보인다.
  test("리포트 서버에 기록이 없는 렌탈이면 관리자 렌탈 상세에 리포트 보기 대신 '리포트 기록이 아직 없습니다'가 보인다", async () => {
    const rentalId = firstRentalId();
    db.report.timelines.delete(rentalId);
    renderAsAdmin(`/admin/rentals/${rentalId}`);
    expect(await screen.findByText("리포트 기록이 아직 없습니다")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "리포트 보기" })).not.toBeInTheDocument();
  });

  // [상황] 기록이 없다는 안내를 보는 사이 리포트 기록이 생겼고, "다시 확인"을 누른다.
  // [기대] "리포트 보기" 링크가 나타난다.
  test("기록 없음 안내에서 다시 확인을 누르면 그사이 생긴 리포트로 링크가 나타난다", async () => {
    const u = userEvent.setup();
    const rentalId = firstRentalId();
    const saved = db.report.timelines.get(rentalId);
    db.report.timelines.delete(rentalId);
    renderAsAdmin(`/admin/rentals/${rentalId}`);
    await screen.findByText("리포트 기록이 아직 없습니다");
    if (saved) db.report.timelines.set(rentalId, saved);
    await u.click(screen.getByRole("button", { name: "다시 확인" }));
    expect(await screen.findByRole("link", { name: "리포트 보기" })).toBeInTheDocument();
  });

  // [상황] 관리자가 리포트 기록이 아직 없는 렌탈의 리포트 주소를 직접 연다.
  // [기대] "렌탈을 찾을 수 없습니다" 대신 "이 렌탈의 리포트 기록이 아직 없습니다"와 렌탈 상세 링크가 보인다.
  test("관리자가 기록 없는 리포트 주소를 직접 열면 '렌탈을 찾을 수 없습니다' 대신 기록이 아직 없다는 안내와 렌탈 상세 링크가 보인다", async () => {
    const rentalId = firstRentalId();
    db.report.timelines.delete(rentalId);
    renderAsAdmin(`/my/rentals/${rentalId}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("이 렌탈의 리포트 기록이 아직 없습니다");
    expect(screen.getByRole("link", { name: "렌탈 상세로" })).toHaveAttribute("href", `/admin/rentals/${rentalId}`);
  });

  // [상황] 리포트 기록이 없어(404) 렌탈이 있는지 확인하는데, 그 확인마저 서버 오류(500)로 실패한다.
  // [기대] "렌탈을 찾을 수 없습니다"로 단정하지 않고 다시 시도할 수 있는 오류를 보인다.
  //        ※ 응답 코드: 404 = 찾을 수 없음(없는 주소나 데이터), 500 = 서버 내부 오류
  test("관리자 리포트 404에서 렌탈 확인이 서버 오류로 실패하면 '렌탈 없음' 대신 다시 시도할 수 있는 오류가 보인다", async () => {
    const rentalId = firstRentalId();
    db.report.timelines.delete(rentalId);
    server.use(http.get("*/api/v1/rentals/:rentalId", () => HttpResponse.json({ type: "about:blank", title: "서버 오류", status: 500, code: "INTERNAL_ERROR" }, { status: 500 })));
    renderAsAdmin(`/my/rentals/${rentalId}`);
    expect(await screen.findByRole("button", { name: /다시/ })).toBeInTheDocument();
    expect(screen.queryByText("렌탈을 찾을 수 없습니다.")).not.toBeInTheDocument();
  });

  // [상황] 관리자가 정말 없는 렌탈의 리포트 주소를 연다.
  // [기대] "렌탈을 찾을 수 없습니다"와 렌탈 목록 링크가 보인다.
  test("관리자가 없는 렌탈의 리포트 주소를 열면 '렌탈을 찾을 수 없습니다'와 렌탈 목록 링크가 보인다", async () => {
    renderAsAdmin(`/my/rentals/${nanoid()}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("렌탈을 찾을 수 없습니다");
    expect(screen.getByRole("link", { name: "렌탈 목록으로" })).toHaveAttribute("href", "/admin/rentals");
  });

  // [상황] 로그인하지 않고 리포트 주소를 연다.
  // [기대] 고객 로그인 화면(/login)으로 간다.
  test("로그인하지 않고 리포트 주소를 열면 고객 로그인으로 간다", async () => {
    const { router } = (await import("../../test/renderApp")).renderApp(`/my/rentals/${firstRentalId()}`);
    await screen.findByRole("button", { name: "로그인" });
    expect(router.state.location.pathname).toBe("/login");
  });
});

// 이 파일이 확인하는 것: 누구나 여는 봉인 기록 검증 페이지(/verify/<토큰>). 봉인 영수증 메일이나 QR의 주소로 들어와,
// 서버에 저장된 검사 기록이 봉인 뒤에 바뀌지 않았는지 확인한 결과를 보여 준다.
// "지문"은 기록 내용으로 만든 64자 해시로, 내용이 한 글자만 바뀌어도 달라진다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderApp, renderAsAdmin } from "../../test/renderApp";
import { server } from "../../shared/mocks/node";
import { VERIFY_TOKENS } from "../../shared/mocks/handlers/verify";
import { tokenStore } from "../../shared/auth/tokenStore";
import { shortHash } from "./format";

// 테스트 도구: 가짜 서버가 출고 시점 지문으로 돌려주는 64자 값.
const OUT_HASH = "7f3a0c1e5b9d2f4a6c8e0b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7de21b";

// [상황] 로그인하지 않고 정상 기록의 검증 주소를 연다.
// [기대] "기록이 그대로입니다"와 기종이 보이고, 출고 → 수령 순서로 시점마다 등급(A등급)·줄인 지문(앞 4자…뒤 4자)·봉인 시각,
//        그리고 확인한 시각이 보인다.
test("로그인하지 않고 검증 주소를 열면 정상 표시, 기종, 시점 순서대로 등급·지문·봉인 시각이 보인다", async () => {
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText("기록이 그대로입니다")).toBeInTheDocument();
  expect(screen.getByText("MacBook Air (M2, 2022)")).toBeInTheDocument();
  const items = within(screen.getByRole("list", { name: "시점 기록" })).getAllByRole("listitem");
  expect(items.map((li) => li.getAttribute("aria-label"))).toEqual(["출고", "수령"]);
  const out = within(items[0]);
  expect(out.getByText("A등급")).toBeInTheDocument();
  expect(out.getByText("7f3a…e21b")).toBeInTheDocument();
  expect(out.getByText(/봉인 2026\. 11\. 12\. 09:00/)).toBeInTheDocument();
  expect(screen.getByText(/확인한 시각/)).toBeInTheDocument();
});

// [상황] 수령 시점에 등급이 없다.
// [기대] "등급 없음"으로 보인다.
test("등급이 없는 시점은 등급 없음으로 보인다", async () => {
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  const rcv = await screen.findByRole("listitem", { name: "수령" });
  expect(within(rcv).getByText("등급 없음")).toBeInTheDocument();
});

// [상황] 출고 시점의 "전체 보기"를 눌렀다가 "접기"를 누른다.
// [기대] 64자 지문 전체가 보였다가 다시 줄인 모양으로 돌아간다(메일 속 지문과 한 글자씩 비교할 때 씀).
test("지문은 전체 보기를 누르면 64자 전체가 보이고 접을 수 있다", async () => {
  const u = userEvent.setup();
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  const out = await screen.findByRole("listitem", { name: "출고" });
  await u.click(within(out).getByRole("button", { name: "전체 보기" }));
  expect(within(out).getByText(OUT_HASH)).toBeInTheDocument();
  await u.click(within(out).getByRole("button", { name: "접기" }));
  expect(within(out).getByText(shortHash(OUT_HASH))).toBeInTheDocument();
});

// [상황] 서버가 봉인 뒤 기록이 바뀌었다고 답한다.
// [기대] 맨 위에 "기록이 바뀌었습니다"와 "이 리포트를 믿지 마세요", 아래 내용은 참고용이라는 안내가 보이고, "그대로입니다"는 어디에도 없다.
test("서버가 기록이 바뀌었다고 하면 경고가 맨 위에 보이고 그대로라는 문구는 어디에도 없다", async () => {
  renderApp(`/verify/${VERIFY_TOKENS.tampered}`);
  expect(await screen.findByText("기록이 바뀌었습니다")).toBeInTheDocument();
  expect(screen.getByText(/이 리포트를 믿지 마세요/)).toBeInTheDocument();
  expect(screen.getByText(/참고용/)).toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다/)).not.toBeInTheDocument();
});

// [상황] 형식이 맞지 않는 토큰으로 주소를 연다.
// [기대] 서버에 묻지 않고 "검증할 기록을 찾을 수 없습니다"를 보인다.
test("형식이 틀린 토큰은 서버를 부르지 않고 찾을 수 없다고 보인다", async () => {
  let called = false;
  server.use(http.get("*/api/v1/verify/:token", () => { called = true; return HttpResponse.json({}); }));
  renderApp("/verify/NOT-A-TOKEN");
  expect(await screen.findByText("검증할 기록을 찾을 수 없습니다")).toBeInTheDocument();
  expect(called).toBe(false);
});

// [상황] 형식은 맞지만 서버에 없는 토큰이다(404).
// [기대] "검증할 기록을 찾을 수 없습니다"가 보이고 "그대로입니다"는 없다.
//        ※ 응답 코드: 404 = 찾을 수 없음(없는 주소나 데이터)
test("서버가 404를 주면 찾을 수 없다고 보인다", async () => {
  renderApp(`/verify/${"a".repeat(32)}`);
  expect(await screen.findByText("검증할 기록을 찾을 수 없습니다")).toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다/)).not.toBeInTheDocument();
});

// [상황] 처음엔 서버가 500 오류를 내고, 고친 뒤 "다시 시도"를 누른다.
// [기대] 처음엔 "지금 확인할 수 없습니다"(그대로라고 속이지 않음), 다시 시도하면 "기록이 그대로입니다"가 보인다.
//        ※ 응답 코드: 500 = 서버 내부 오류
test("서버 오류면 지금 확인할 수 없다고 보이고 다시 시도하면 결과가 보인다", async () => {
  const u = userEvent.setup();
  let fail = true;
  server.use(
    http.get("*/api/v1/verify/:token", () =>
      fail ? HttpResponse.json({ status: 500 }, { status: 500 }) : undefined,
    ),
  );
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText(/지금 확인할 수 없습니다/)).toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다/)).not.toBeInTheDocument();
  fail = false;
  await u.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("기록이 그대로입니다")).toBeInTheDocument();
});

// [상황] 오류 뒤 "다시 시도"를 눌렀고, 서버 응답이 늦게 온다.
// [기대] 응답 전에는 "기록을 확인하는 중입니다…"만 보이고 오류도, 그대로/바뀜 결과도 보이지 않는다. 응답이 오면 결과가 보인다.
test("다시 시도를 누르면 응답이 오기 전까지 오류 대신 대조 중으로 보이고 성공·실패는 아직 보이지 않는다", async () => {
  const u = userEvent.setup();
  let release: () => void = () => undefined;
  let fail = true;
  server.use(
    http.get("*/api/v1/verify/:token", async () => {
      if (fail) return HttpResponse.json({ status: 500 }, { status: 500 });
      await new Promise<void>((r) => (release = r));
      return undefined;
    }),
  );
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText(/지금 확인할 수 없습니다/)).toBeInTheDocument();
  fail = false;
  await u.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("기록을 확인하는 중입니다…")).toBeInTheDocument();
  expect(screen.queryByText(/지금 확인할 수 없습니다/)).not.toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다|바뀌었습니다/)).not.toBeInTheDocument();
  release();
  expect(await screen.findByText("기록이 그대로입니다")).toBeInTheDocument();
});

// [상황] 네트워크 오류로 서버에 닿지 못한다.
// [기대] "지금 확인할 수 없습니다"가 보인다.
test("서버에 닿지 못하면 지금 확인할 수 없다고 보인다", async () => {
  server.use(http.get("*/api/v1/verify/:token", () => HttpResponse.error()));
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText(/지금 확인할 수 없습니다/)).toBeInTheDocument();
});

// [상황] 관리자로 로그인한 브라우저에서 검증 페이지를 연다.
// [기대] 검증 요청에 로그인 출입증(Authorization)과 쿠키를 싣지 않는다(공개 페이지라 누구에게나 같은 결과, 로그인 정보 노출 방지).
test("관리자로 로그인해 있어도 검증 요청에는 토큰·쿠키를 붙이지 않는다", async () => {
  let auth: string | null = "unset";
  let credentials: RequestCredentials | undefined;
  server.use(
    http.get("*/api/v1/verify/:token", ({ request }) => {
      auth = request.headers.get("Authorization");
      credentials = request.credentials;
      return undefined;
    }),
  );
  renderAsAdmin(`/verify/${VERIFY_TOKENS.valid}`);
  await waitFor(() => expect(tokenStore.get()).not.toBeNull());
  expect(await screen.findByText("기록이 그대로입니다")).toBeInTheDocument();
  expect(auth).toBeNull();
  expect(credentials).toBe("omit");
});

// [상황] 서버 응답에 계약에 없는 칸(대여자 이메일)이 잘못 섞여 온다.
// [기대] 화면에 그 이메일을 찍지 않는다(개인정보가 새지 않게, 계약에 있는 칸만 보여 줌).
test("응답에 계약에 없는 필드가 섞여 와도 화면에 찍지 않는다", async () => {
  server.use(
    http.get("*/api/v1/verify/:token", () =>
      HttpResponse.json({ valid: true, modelName: "X", records: [], checkedAt: "2026-11-12T00:00:00Z", renterEmail: "leak@example.com" }),
    ),
  );
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText("기록이 그대로입니다")).toBeInTheDocument();
  expect(screen.queryByText(/leak@example.com/)).not.toBeInTheDocument();
});

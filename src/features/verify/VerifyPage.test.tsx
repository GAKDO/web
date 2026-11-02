import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderApp, renderAsAdmin } from "../../test/renderApp";
import { server } from "../../shared/mocks/node";
import { VERIFY_TOKENS } from "../../shared/mocks/handlers/verify";
import { tokenStore } from "../../shared/auth/tokenStore";
import { shortHash } from "./format";

const OUT_HASH = "7f3a0c1e5b9d2f4a6c8e0b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7de21b";

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

test("등급이 없는 시점은 등급 없음으로 보인다", async () => {
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  const rcv = await screen.findByRole("listitem", { name: "수령" });
  expect(within(rcv).getByText("등급 없음")).toBeInTheDocument();
});

test("지문은 전체 보기를 누르면 64자 전체가 보이고 접을 수 있다", async () => {
  const u = userEvent.setup();
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  const out = await screen.findByRole("listitem", { name: "출고" });
  await u.click(within(out).getByRole("button", { name: "전체 보기" }));
  expect(within(out).getByText(OUT_HASH)).toBeInTheDocument();
  await u.click(within(out).getByRole("button", { name: "접기" }));
  expect(within(out).getByText(shortHash(OUT_HASH))).toBeInTheDocument();
});

test("서버가 기록이 바뀌었다고 하면 경고가 맨 위에 보이고 그대로라는 문구는 어디에도 없다", async () => {
  renderApp(`/verify/${VERIFY_TOKENS.tampered}`);
  expect(await screen.findByText("기록이 바뀌었습니다")).toBeInTheDocument();
  expect(screen.getByText(/이 리포트를 믿지 마세요/)).toBeInTheDocument();
  expect(screen.getByText(/참고용/)).toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다/)).not.toBeInTheDocument();
});

test("형식이 틀린 토큰은 서버를 부르지 않고 찾을 수 없다고 보인다", async () => {
  let called = false;
  server.use(http.get("*/api/v1/verify/:token", () => { called = true; return HttpResponse.json({}); }));
  renderApp("/verify/NOT-A-TOKEN");
  expect(await screen.findByText("검증할 기록을 찾을 수 없습니다")).toBeInTheDocument();
  expect(called).toBe(false);
});

test("서버가 404를 주면 찾을 수 없다고 보인다", async () => {
  renderApp(`/verify/${"a".repeat(32)}`);
  expect(await screen.findByText("검증할 기록을 찾을 수 없습니다")).toBeInTheDocument();
  expect(screen.queryByText(/그대로입니다/)).not.toBeInTheDocument();
});

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

test("서버에 닿지 못하면 지금 확인할 수 없다고 보인다", async () => {
  server.use(http.get("*/api/v1/verify/:token", () => HttpResponse.error()));
  renderApp(`/verify/${VERIFY_TOKENS.valid}`);
  expect(await screen.findByText(/지금 확인할 수 없습니다/)).toBeInTheDocument();
});

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

// 이 파일이 확인하는 것: 고객 리포트 화면의 실시간 검사 진행률. 반납 사진을 올린 뒤 검사·봉인까지의 단계와 퍼센트가
// 새로 고침 없이 시점 카드에 바뀌어 보인다(서버가 SSE라는 방식으로 밀어 줌).

import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { streamControl } from "../../shared/mocks/handlers/report";

// 테스트 도구: 가짜 데이터에서 고객이 가진 렌탈 번호 목록.
const rentalIds = () => [...db.report.owners.keys()];
// 테스트 도구: 리포트의 시점 목록에서 이름(예: "반납")으로 시점 카드 하나를 찾는다.
const step = (name: string) => within(screen.getByRole("list", { name: "시점" })).getByRole("listitem", { name });

// 테스트 도구: "첫 이벤트 뒤 연결 끊기" 설정을 테스트마다 끈다.
afterEach(() => {
  streamControl.dropAfterFirst = false;
});

// [상황] 반납 시점이 검사 중인 리포트를 열어 두고, 서버가 "사진 올림 20%", "흠집 검사 60%"를 차례로 보낸다.
// [기대] 반납 카드의 글자가 새로 고침 없이 "사진 올림 · 20%" → "흠집 검사 · 60%"로 바뀐다.
test("검사 중인 시점은 리포트를 열어 두면 진행 단계와 퍼센트가 새로고침 없이 바뀐다", async () => {
  // 테스트가 이벤트를 하나씩 보내는 스트림(시간에 기대지 않음)
  const stream: { push: ((stage: string, percent: number) => void) | null } = { push: null };
  const rentalId = rentalIds()[0];
  const pending = db.report.timelines.get(rentalId)?.checkpoints.find((c) => c.status !== "SEALED");
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          stream.push = (stage, percent) =>
            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({ checkpointId: pending?.checkpointId, stage, percent, at: new Date().toISOString() })}\n\n`));
        },
      });
      return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
    }),
  );
  renderAsCustomer(`/my/rentals/${rentalId}`);
  await waitFor(() => expect(stream.push).not.toBeNull());
  stream.push?.("UPLOADED", 20);
  expect(await within(step("반납")).findByText("사진 올림 · 20%")).toBeInTheDocument();
  stream.push?.("INSPECTED", 60);
  expect(await within(step("반납")).findByText("흠집 검사 · 60%")).toBeInTheDocument();
});

// [상황] 리포트를 열어 둔 사이 검사가 끝나 봉인 알림이 온다.
// [기대] 리포트를 다시 읽어 반납 카드가 "봉인됨", "등급 A"로 채워진다.
test("진행이 끝나 봉인 알림이 오면 리포트를 다시 읽어 등급이 채워진다", async () => {
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText("봉인됨", {}, { timeout: 3000 })).toBeInTheDocument();
  expect(within(step("반납")).getByText("등급 A")).toBeInTheDocument();
});

// [상황] 진행률 연결이 첫 소식 뒤 끊긴다.
// [기대] "다시 연결 중…"이 잠깐 보이고, 다시 붙어 봉인 소식까지 이어서 받는다.
test("연결이 끊기면 '다시 연결 중'이 잠깐 보이고 다시 붙어 이어서 받는다", async () => {
  streamControl.dropAfterFirst = true;
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText("다시 연결 중…")).toBeInTheDocument();
  await within(step("반납")).findByText("봉인됨", {}, { timeout: 4000 });
}, 10_000);

// [상황] 모든 시점이 이미 봉인된 렌탈의 리포트를 연다.
// [기대] 진행률 연결을 한 번도 열지 않는다(받을 소식이 없으니 서버 부담을 줄임).
test("모든 시점이 봉인된 리포트는 진행률 연결을 열지 않는다", async () => {
  let opened = 0;
  server.events.on("request:start", ({ request }) => {
    if (request.url.endsWith("/stream")) opened += 1;
  });
  renderAsCustomer(`/my/rentals/${rentalIds()[1]}`);
  await screen.findByRole("region", { name: "시점 비교" });
  server.events.removeAllListeners();
  expect(opened).toBe(0);
});

// [상황] 서버가 진행률 연결을 403(권한 없음)으로 거절한다.
// [기대] 다시 붙으려 하지 않고, 반납 카드에 "실시간 진행률을 받지 못했습니다" 안내를 보인다.
//        ※ 응답 코드: 403 = 권한 없음(누구인지는 알지만 허락되지 않은 일)
test("진행률 연결이 거절되면(403) 다시 붙지 않고 시점 카드에 안내를 보인다", async () => {
  server.use(http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 403 })));
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText(/실시간 진행률을 받지 못했습니다/)).toBeInTheDocument();
  expect(within(step("반납")).queryByText("다시 연결 중…")).not.toBeInTheDocument();
});

// [상황] 리포트를 읽은 직후, 진행률 연결이 붙기 직전에 반납 시점이 봉인됐다. 서버는 이미 끝난 봉인 소식을 다시 보내지 않는다.
// [기대] 연결이 붙을 때 타임라인을 한 번 더 읽어, 반납 카드가 "봉인됨", "등급 B"로 바뀐다(소식을 놓쳐도 화면이 멈추지 않음).
test("리포트를 읽은 뒤 스트림이 붙기 전에 봉인된 시점도, done 없이 연결될 때 타임라인을 다시 읽어 봉인으로 바뀐다", async () => {
  const rentalId = rentalIds()[0];
  const pending = db.report.timelines.get(rentalId)?.checkpoints.find((c) => c.status !== "SEALED");
  server.use(
    http.get("*/api/v1/reports/rentals/:rentalId/stream", () => {
      // 연결 직전에 봉인됐고, 서버는 이미 끝난 봉인의 done을 다시 보내지 않는다
      if (pending) {
        pending.status = "SEALED";
        pending.grade = "B";
        pending.sealedAt = new Date().toISOString();
      }
      return new HttpResponse(new ReadableStream<Uint8Array>(), { headers: { "Content-Type": "text/event-stream" } });
    }),
  );
  renderAsCustomer(`/my/rentals/${rentalId}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText("봉인됨")).toBeInTheDocument();
  expect(within(step("반납")).getByText("등급 B")).toBeInTheDocument();
});

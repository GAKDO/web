import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { streamControl } from "../../shared/mocks/handlers/report";

const rentalIds = () => [...db.report.owners.keys()];
const step = (name: string) => within(screen.getByRole("list", { name: "시점" })).getByRole("listitem", { name });

afterEach(() => {
  streamControl.dropAfterFirst = false;
});

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

test("진행이 끝나 봉인 알림이 오면 리포트를 다시 읽어 등급이 채워진다", async () => {
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText("봉인됨", {}, { timeout: 3000 })).toBeInTheDocument();
  expect(within(step("반납")).getByText("등급 A")).toBeInTheDocument();
});

test("연결이 끊기면 '다시 연결 중'이 잠깐 보이고 다시 붙어 이어서 받는다", async () => {
  streamControl.dropAfterFirst = true;
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText("다시 연결 중…")).toBeInTheDocument();
  await within(step("반납")).findByText("봉인됨", {}, { timeout: 4000 });
}, 10_000);

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

test("진행률 연결이 거절되면(403) 다시 붙지 않고 시점 카드에 안내를 보인다", async () => {
  server.use(http.get("*/api/v1/reports/rentals/:rentalId/stream", () => new HttpResponse(null, { status: 403 })));
  renderAsCustomer(`/my/rentals/${rentalIds()[0]}`);
  await screen.findByRole("list", { name: "시점" });
  expect(await within(step("반납")).findByText(/실시간 진행률을 받지 못했습니다/)).toBeInTheDocument();
  expect(within(step("반납")).queryByText("다시 연결 중…")).not.toBeInTheDocument();
});

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

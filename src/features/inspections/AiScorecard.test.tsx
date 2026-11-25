// 이 파일이 확인하는 것: 관리자 검사 화면의 "AI 후보 검수 결과" 성적표. 사람 검수에서 AI 후보가 얼마나 흠집으로 확정됐는지 보여 준다.

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { DefectReviewQueueItem } from "../../shared/api/types";
import { server } from "../../shared/mocks/node";
import { renderAsAdmin } from "../../test/renderApp";
import { scoreOf } from "./components/AiScorecard";

// 테스트 도구: 검수가 끝난 시점 하나(확정·기각 수, 모델 버전)를 만든다.
function done(confirmed: number, dismissed: number, modelVersion: string | null = "v004"): DefectReviewQueueItem {
  return {
    checkpointId: `cp-${confirmed}-${dismissed}`,
    rentalId: "rental-1",
    captureSetId: "set-1",
    source: "BOOTH",
    profile: "FULL",
    modelVersion,
    pending: 0,
    confirmed,
    dismissed,
    completedAt: "2026-11-10T14:03:05+09:00",
    reviewCompletedAt: "2026-11-10T14:20:00+09:00",
  };
}

// [상황] 검수 완료 시점 3개: 확정 8·기각 1, 확정 2·기각 0, 후보 없음.
// [기대] 시점 3개, 확정 10, 기각 1, 확정 비율 91%이고 모델별(v004) 합계도 나온다. 후보가 하나도 없으면 비율은 없음이다.
test("검수 완료 시점의 확정·기각 후보를 더해 확정 비율을 내고, 후보가 없던 시점은 시점 수에만 센다", () => {
  const score = scoreOf([done(8, 1), done(2, 0), done(0, 0, null)]);
  expect(score).toMatchObject({ checkpoints: 3, confirmed: 10, dismissed: 1, precision: 91 });
  expect(score.byModel).toEqual([{ modelVersion: "v004", confirmed: 10, dismissed: 1 }]);
  expect(scoreOf([done(0, 0)]).precision).toBeNull();
});

// [상황] 관리자가 검사 결과 화면을 연다(최근 검수 완료 2건).
// [기대] "AI 후보 10개를 흠집으로 확정하고 1개를 흠집 아님으로 정했습니다. 확정 비율 91%"와 모델별 수가 보인다.
test("관리자 검사 결과 화면에 최근 검수 완료 기준 AI 후보 확정·기각 수와 확정 비율이 보인다", async () => {
  server.use(
    http.get("*/api/v1/captures/reviews", ({ request }) =>
      HttpResponse.json({ items: new URL(request.url).searchParams.get("status") === "CONFIRMED" ? [done(8, 1), done(2, 0)] : [] }),
    ),
  );
  renderAsAdmin("/admin/inspections");
  expect(await screen.findByRole("heading", { name: "AI 후보 검수 결과" })).toBeInTheDocument();
  expect(screen.getByText(/최근 검수 완료 2건에서 AI 후보 10개를 흠집으로 확정하고 1개를 흠집 아님으로 정했습니다. 확정 비율 91%/)).toBeInTheDocument();
  expect(screen.getByText(/v004 확정 10·아님 1/)).toBeInTheDocument();
});

// [상황] 검수 완료 목록 요청이 서버 오류(500)다.
// [기대] 성적표 대신 실패 안내와 "다시 불러오기" 버튼이 보인다.
//        ※ 응답 코드: 500 = 서버 내부 오류
test("검수 결과를 불러오지 못하면 성적표 대신 실패 안내와 다시 불러오기가 보인다", async () => {
  server.use(
    http.get("*/api/v1/captures/reviews", ({ request }) =>
      new URL(request.url).searchParams.get("status") === "CONFIRMED"
        ? HttpResponse.json({ type: "about:blank", title: "오류", status: 500, code: "INTERNAL_ERROR" }, { status: 500 })
        : HttpResponse.json({ items: [] }),
    ),
  );
  renderAsAdmin("/admin/inspections");
  expect(await screen.findByText("AI 후보 검수 결과를 불러오지 못했습니다.", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
});

// [상황] 검수를 끝낸 시점이 하나도 없다.
// [기대] 성적표를 보이지 않는다.
test("검수를 끝낸 시점이 없으면 AI 성적표를 보이지 않는다", async () => {
  server.use(http.get("*/api/v1/captures/reviews", () => HttpResponse.json({ items: [] })));
  renderAsAdmin("/admin/inspections");
  expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "AI 후보 검수 결과" })).not.toBeInTheDocument();
});

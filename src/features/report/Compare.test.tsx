// 이 파일이 확인하는 것: 고객 리포트의 "시점 비교" 표. 출고·수령·반납을 나란히 놓고 등급, 새 흠집, 배터리 등 진단 변화를 보여 준다.

import { screen, within } from "@testing-library/react";
import { renderAsCustomer } from "../../test/renderApp";
import { http } from "msw";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";

// 테스트 도구: 가짜 데이터에서 고객이 가진 첫 렌탈 ID를 꺼낸다.
const firstRentalId = () => [...db.report.owners.keys()][0];

// 테스트 도구: 고객으로 리포트를 열고 시점 비교 칸을 찾는다.
async function openCompare(rentalId = firstRentalId()) {
  renderAsCustomer(`/my/rentals/${rentalId}`);
  return screen.findByRole("region", { name: "시점 비교" });
}

// [상황] 출고·수령이 봉인된 렌탈의 비교표를 본다.
// [기대] 수령 칸에 등급 B, 새 흠집 1개와 흠집 확대 사진, 배터리 84.0%(−7.2%p, 경고색)가 보인다.
//        출고 칸은 "기준 시점"이고, 아직 없는 반납 칸은 없다.
test("출고·수령 두 시점이 봉인되면 비교표에 등급, 신규 흠집 수와 크롭 사진, 배터리 최대 용량과 차이가 보인다", async () => {
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(within(rcv).getByText("B")).toBeInTheDocument();
  expect(within(rcv).getByText("1개")).toBeInTheDocument();
  expect(await within(rcv).findByRole("img", { name: "수령 신규 흠집 사진" })).toBeInTheDocument();
  expect(await within(rcv).findByText("84.0% (−7.2%p)")).toHaveClass("warn");
  expect(within(await screen.findByRole("region", { name: "출고 비교" })).getByText("기준 시점")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "반납 비교" })).not.toBeInTheDocument();
});

// [상황] 수령 진단에 배터리 점검 플래그가 있다.
// [기대] "배터리 용량이 크게 줄었습니다"처럼 사람이 읽는 문장으로 보인다.
test("진단에 점검 플래그가 있으면 사람이 읽는 문장으로 보인다", async () => {
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(await within(rcv).findByText("배터리 용량이 크게 줄었습니다")).toBeInTheDocument();
});

// [상황] 진단 중 권한이 없어 못 읽은 항목이 있다.
// [기대] 빈칸 대신 "읽지 못함 (권한 없음)"이 보인다.
test("진단을 못 읽은 항목은 빈칸 대신 '읽지 못함'과 사유가 보인다", async () => {
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(await within(rcv).findByText("읽지 못함 (권한 없음)")).toBeInTheDocument();
});

// [상황] 출고 시점에 진단 기록이 없다.
// [기대] "읽지 못함 (진단 기록 없음)"으로 보인다.
test("진단 기록이 없는 시점은 '진단 기록 없음'으로 보인다", async () => {
  const rentalId = firstRentalId();
  const out = db.report.timelines.get(rentalId)?.checkpoints[0].checkpointId ?? "";
  db.report.diagnostics.delete(out);
  await openCompare(rentalId);
  const col = await screen.findByRole("region", { name: "출고 비교" });
  expect((await within(col).findAllByText("읽지 못함 (진단 기록 없음)")).length).toBeGreaterThan(0);
});

// [상황] 진단 서버가 500 오류를 낸다.
// [기대] "진단 기록 없음"이 아니라 "진단을 불러오지 못함"과 "진단 다시 불러오기" 버튼이 보인다(없는 것과 못 읽은 것을 구분).
test("진단 서버 오류는 '진단 기록 없음'이 아니라 '진단을 불러오지 못함'과 다시 불러오기 버튼으로 보인다", async () => {
  server.use(http.get("*/api/v1/diagnostics/checkpoints/:checkpointId", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect((await within(rcv).findAllByText("읽지 못함 (진단을 불러오지 못함)")).length).toBeGreaterThan(0);
  expect(within(rcv).getByRole("button", { name: "진단 다시 불러오기" })).toBeInTheDocument();
  expect(within(rcv).queryByText(/진단 기록 없음/)).not.toBeInTheDocument();
});

// [상황] 흠집 확대 사진 목록을 받지 못했다(404).
// [기대] 새 흠집 칸에 "(사진 없음)"이 보인다.
test("흠집 크롭 사진을 받지 못하면 신규 흠집 칸에 '사진 없음'이 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/media", () => problem(404, "NOT_FOUND", "없음")));
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(await within(rcv).findByText("(사진 없음)")).toBeInTheDocument();
});

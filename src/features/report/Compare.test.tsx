import { screen, within } from "@testing-library/react";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

const firstRentalId = () => [...db.report.owners.keys()][0];

async function openCompare(rentalId = firstRentalId()) {
  renderAsCustomer(`/my/rentals/${rentalId}`);
  return screen.findByRole("region", { name: "시점 비교" });
}

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

test("진단에 점검 플래그가 있으면 사람이 읽는 문장으로 보인다", async () => {
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(await within(rcv).findByText("배터리 용량이 크게 줄었습니다")).toBeInTheDocument();
});

test("진단을 못 읽은 항목은 빈칸 대신 '읽지 못함'과 사유가 보인다", async () => {
  await openCompare();
  const rcv = await screen.findByRole("region", { name: "수령 비교" });
  expect(await within(rcv).findByText("읽지 못함 (smartctl 권한 없음)")).toBeInTheDocument();
});

test("진단 기록이 없는 시점은 '진단 기록 없음'으로 보인다", async () => {
  const rentalId = firstRentalId();
  const out = db.report.timelines.get(rentalId)?.checkpoints[0].checkpointId ?? "";
  db.report.diagnostics.delete(out);
  await openCompare(rentalId);
  const col = await screen.findByRole("region", { name: "출고 비교" });
  expect((await within(col).findAllByText("읽지 못함 (진단 기록 없음)")).length).toBeGreaterThan(0);
});

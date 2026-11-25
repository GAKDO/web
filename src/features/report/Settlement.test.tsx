// 이 파일이 확인하는 것: 반납 정산서 화면. 반납 때 새로 생긴 흠집마다 적용 규칙과 차감 금액을 보여 준다.

import { render, screen, within } from "@testing-library/react";
import type { Settlement } from "../../shared/api/types";
import { SettlementView } from "./components/SettlementCard";

// 테스트 도구: 준비된 반납 정산서(찍힘 80,000원, 생활 마모 긁힘 0원, 합계 80,000원).
const ready: Settlement = {
  checkpointId: "CP_RET",
  checkpointType: "RET",
  status: "READY",
  ruleVersion: "settlement-rules-v1",
  currency: "KRW",
  grade: "C",
  lines: [
    { defectId: "d1", face: "TOP", class: "dent", lengthMm: 6, areaMm2: 12.5, amount: 80000, rule: "찍힘 5mm 이상" },
    { defectId: "d2", face: "BOT", class: "scratch", lengthMm: 7.5, areaMm2: null, amount: 0, rule: "긁힘 10mm 미만(생활 마모)" },
  ],
  subtotal: 80000,
  cap: 300000,
  total: 80000,
  notes: ["이전 시점에 있던 흠집 2개는 빼고 계산"],
};

// [상황] 준비된 반납 정산서를 연다.
// [기대] 흠집마다 규칙("찍힘 5mm 이상")과 금액(80,000원, 0원)이 표로 보이고, 아래에 차감 합계·계산 안내·규칙 버전이 보인다.
test("반납 정산서는 신규 흠집마다 적용 규칙과 금액을, 아래에 차감 합계와 규칙 버전을 보인다", () => {
  render(<SettlementView data={ready} />);
  const rows = screen.getAllByRole("row");
  expect(within(rows[1]).getByText("찍힘 5mm 이상")).toBeInTheDocument();
  expect(within(rows[1]).getByText("80,000원")).toBeInTheDocument();
  expect(within(rows[2]).getByText("0원")).toBeInTheDocument();
  expect(screen.getByLabelText("차감 합계")).toHaveTextContent("80,000원");
  expect(screen.getByText("이전 시점에 있던 흠집 2개는 빼고 계산")).toBeInTheDocument();
  expect(screen.getByText(/settlement-rules-v1/)).toBeInTheDocument();
});

// [상황] 반납 때 새 흠집이 하나도 없다.
// [기대] 표 대신 "새로 생긴 흠집이 없어 차감할 금액이 없습니다"와 합계 0원이 보인다.
test("새로 생긴 흠집이 없으면 표 대신 차감할 금액이 없다고 보인다", () => {
  render(<SettlementView data={{ ...ready, lines: [], subtotal: 0, total: 0, notes: [] }} />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("반납 때 새로 생긴 흠집이 없어 차감할 금액이 없습니다.")).toBeInTheDocument();
  expect(screen.getByLabelText("차감 합계")).toHaveTextContent("0원");
});

// [상황] 수령 시점의 정산서를 연다(정산 대상 아님).
// [기대] "수령 때 새로 생긴 흠집은 배송 중 손상이라 고객에게 차감하지 않습니다" 이유가 보인다.
test("출고·수령 시점은 정산 대상이 아니라는 이유를 보인다", () => {
  render(<SettlementView data={{ ...ready, checkpointType: "RCV", status: "NOT_APPLICABLE", lines: [], notes: ["수령 때 새로 생긴 흠집은 배송 중 손상이라 고객에게 차감하지 않습니다"] }} />);
  expect(screen.getByText("수령 때 새로 생긴 흠집은 배송 중 손상이라 고객에게 차감하지 않습니다")).toBeInTheDocument();
});

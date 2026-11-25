// 이 파일이 확인하는 것: 관리자 화면의 막대 그래프 부품(속도·진단 추이 등에 쓰임).

import { render, screen } from "@testing-library/react";
import { ColumnChart, niceMax } from "./ColumnChart";

describe("막대 그래프", () => {
  // [상황] 데이터 최댓값이 0, 1, 3, 5, 13, 45처럼 제각각이다.
  // [기대] 그래프 위쪽 끝 값을 짝수로 올려 가운데 눈금이 정수가 되게 한다(예: 45 → 60).
  it("가운데 눈금이 정수가 되게 짝수로 올린다", () => {
    expect([0, 1, 2, 3, 5, 7, 9, 13, 45].map(niceMax)).toEqual([2, 2, 2, 4, 6, 8, 10, 20, 60]);
  });

  // [상황] 이름이 같은 막대 두 개("R-1 출고")를 그린다.
  // [기대] 둘 다 그려지고, 함께 보이는 표에도 머리 행 + 2행이 다 나온다(같은 이름이라 하나가 사라지지 않음).
  it("라벨이 같아도 막대와 표 행이 모두 그려진다", () => {
    render(<ColumnChart title="t" unit="%" columns={[{ label: "R-1 출고", values: [20] }, { label: "R-1 출고", values: [25] }]} series={[{ name: "a", color: "#000" }]} />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

import { render, screen } from "@testing-library/react";
import { ColumnChart, niceMax } from "./ColumnChart";

describe("막대 그래프", () => {
  it("가운데 눈금이 정수가 되게 짝수로 올린다", () => {
    expect([0, 1, 2, 3, 5, 7, 9, 13, 45].map(niceMax)).toEqual([2, 2, 2, 4, 6, 8, 10, 20, 60]);
  });

  it("라벨이 같아도 막대와 표 행이 모두 그려진다", () => {
    render(<ColumnChart title="t" unit="%" columns={[{ label: "R-1 출고", values: [20] }, { label: "R-1 출고", values: [25] }]} series={[{ name: "a", color: "#000" }]} />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});

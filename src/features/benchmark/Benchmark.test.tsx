import { screen, within } from "@testing-library/react";
import { renderAsAdmin } from "../../test/renderApp";

describe("성능 그래프 화면", () => {
  it("관리 메뉴에서 열리고, 서버 검사 결과로 요약과 그래프를 그리며 세트별 처리 시간과 모델 점수 칸을 보인다", async () => {
    renderAsAdmin("/admin/benchmark");
    expect(await screen.findByRole("heading", { name: "성능 그래프" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /성능/ }).length).toBeGreaterThan(0);
    const grades = await screen.findByRole("figure", { name: "등급 분포" });
    expect(within(grades).getAllByText("A등급").length).toBeGreaterThan(0);
    // 처리 시간(GET /captures/benchmarks): 부스 막대에 목표 30초 선, 폰은 따로, 모델 점수는 아직 없음
    const booth = await screen.findByRole("figure", { name: "부스 판정 시간" });
    expect(within(booth).getAllByText("목표 30초").length).toBeGreaterThan(0);
    expect(screen.getByRole("figure", { name: "폰 촬영 처리 시간" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "모델 정확도(mAP)" })).toHaveTextContent("아직 서버에 없습니다");
    expect(screen.getByText("26.5초")).toBeInTheDocument(); // 부스 판정 중간값(24.8·26.5·34.1)
  });
});

import { screen, within } from "@testing-library/react";
import { renderAsAdmin } from "../../test/renderApp";

describe("성능 그래프 화면", () => {
  it("관리 메뉴에서 열리고, 서버 검사 결과로 요약과 그래프를 그리며 서버에 없는 값은 빈칸으로 알린다", async () => {
    renderAsAdmin("/admin/benchmark");
    expect(await screen.findByRole("heading", { name: "성능 그래프" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /성능/ }).length).toBeGreaterThan(0);
    const grades = await screen.findByRole("figure", { name: "등급 분포" });
    expect(within(grades).getAllByText("A등급").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "부스 판정 시간" })).toHaveTextContent("아직 서버로 보내지 않아");
  });
});

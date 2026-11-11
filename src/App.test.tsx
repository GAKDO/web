import { screen, within } from "@testing-library/react";
import { renderApp } from "./test/renderApp";

test("첫 화면 맨 위 고정 헤더에 서비스 이름(TRACE 로고)이 보이고, 큰 제목이 한 개 있다", async () => {
  renderApp("/");
  const logo = await screen.findByRole("link", { name: "TRACE 첫 화면" });
  expect(within(logo).getByRole("img", { name: "TRACE" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
});

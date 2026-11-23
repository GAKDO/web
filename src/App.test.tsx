// 이 파일이 확인하는 것: 사이트 첫 화면의 기본 뼈대.

import { screen, within } from "@testing-library/react";
import { renderApp } from "./test/renderApp";

// [상황] 첫 화면(/)을 연다.
// [기대] 맨 위 헤더에 TRACE 로고(첫 화면으로 가는 링크)가 보이고, 큰 제목(h1)은 하나뿐이다(화면 낭독기 사용자를 위한 구조).
test("첫 화면 맨 위 고정 헤더에 서비스 이름(TRACE 로고)이 보이고, 큰 제목이 한 개 있다", async () => {
  renderApp("/");
  const logo = await screen.findByRole("link", { name: "TRACE 첫 화면" });
  expect(within(logo).getByRole("img", { name: "TRACE" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
});

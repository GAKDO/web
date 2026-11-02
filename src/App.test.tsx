import { screen } from "@testing-library/react";
import { renderApp } from "./test/renderApp";

test("첫 화면에 서비스 이름이 보인다", async () => {
  renderApp("/");
  expect(await screen.findByRole("heading", { name: "TRACE" })).toBeInTheDocument();
});

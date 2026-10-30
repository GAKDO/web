import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("첫 화면에 서비스 이름이 보인다", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "TRACE" })).toBeInTheDocument();
});

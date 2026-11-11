import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaskedSerial } from "./MaskedSerial";

test("시리얼은 가려져 보이다가 눈 버튼을 누르면 전체가 보이고 다시 누르면 가려진다", async () => {
  const user = userEvent.setup();
  render(<MaskedSerial serial="K7QX2M9P4T" />);
  expect(screen.getByText("••••••9P4T")).toBeInTheDocument();
  expect(screen.queryByText("K7QX2M9P4T")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "시리얼 보기" }));
  expect(screen.getByText("K7QX2M9P4T")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "시리얼 가리기" }));
  expect(screen.getByText("••••••9P4T")).toBeInTheDocument();
});

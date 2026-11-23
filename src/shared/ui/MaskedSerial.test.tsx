// 이 파일이 확인하는 것: 가려진 시리얼 번호와 "눈" 버튼(보기/가리기).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaskedSerial } from "./MaskedSerial";

// [상황] 시리얼을 보여 주는 칸에서 "시리얼 보기"를 누르고, 다시 "시리얼 가리기"를 누른다.
// [기대] 처음엔 뒤 4자리만 보이고, 보기를 누르면 전체가, 가리기를 누르면 다시 가려진다.
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

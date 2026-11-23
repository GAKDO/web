// 이 파일이 확인하는 것: 흠집 표시가 그려진 검사 사진 부품이 사진을 못 읽었을 때의 동작.
// 사진 주소는 사전 서명 URL이라 시간이 지나면 만료되고, 화면이 새 주소를 받아 온다.

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PhotoWithDefects } from "./PhotoWithDefects";

// [상황] 사진을 못 읽어 "사진을 불러오지 못함"이 떴다. 같은 주소로 다시 그리고, 그다음 새 주소로 다시 그린다.
// [기대] 같은 주소면 실패 안내가 그대로고, 새 주소가 오면 누르지 않아도 바로 새 사진을 읽어 안내가 사라진다.
test("사진을 못 읽어 안내가 보여도 사진 주소가 새로 발급되면 누르지 않아도 새 주소로 다시 읽는다", () => {
  const { rerender } = render(<PhotoWithDefects src="https://example.test/a.jpg?sig=1" alt="윗면 사진" defects={[]} />);
  fireEvent.error(screen.getByRole("img", { name: "윗면 사진" }));
  expect(screen.getByRole("group", { name: "윗면 사진" })).toHaveTextContent("사진을 불러오지 못함");
  // 같은 주소로 다시 그려도 실패 안내는 그대로
  rerender(<PhotoWithDefects src="https://example.test/a.jpg?sig=1" alt="윗면 사진" defects={[]} />);
  expect(screen.getByText("사진을 불러오지 못함")).toBeInTheDocument();
  // 새 주소(사전 서명 URL 갱신)면 바로 사진으로 돌아간다
  rerender(<PhotoWithDefects src="https://example.test/a.jpg?sig=2" alt="윗면 사진" defects={[]} />);
  expect(screen.getByRole("img", { name: "윗면 사진" })).toHaveAttribute("src", "https://example.test/a.jpg?sig=2");
  expect(screen.queryByText("사진을 불러오지 못함")).not.toBeInTheDocument();
});

// 이 파일이 확인하는 것: 불러오는 중 회색 자리 표시와 몇 가지 공통 화면 부품의 접근성(화면 낭독기·손가락 누름·움직임 줄이기).

import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { buttonVariants } from "@/components/ui/button";
import { useCountUp } from "../motion/useCountUp";
import { LoadingRows } from "./LoadingRows";

// [상황] 렌탈 목록을 불러오는 동안 회색 자리 3줄을 보인다.
// [기대] 화면 낭독기에는 "렌탈 목록을 불러오는 중…" 한 문장만 읽히고 회색 줄은 숨긴다.
test("불러오는 동안 회색 자리는 화면 읽기에서 숨기고 상태 문장 하나만 읽힌다", () => {
  render(<LoadingRows label="렌탈 목록을 불러오는 중…" count={3} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("렌탈 목록을 불러오는 중…");
  expect(status.querySelector("ul")).toHaveAttribute("aria-hidden", "true");
  expect(status.querySelectorAll("li")).toHaveLength(3);
});

// [상황] 리포트 상세용 회색 자리를 보인다.
// [기대] 상태 문장 하나만 읽히고 그림 2개는 숨긴다.
test("상세 화면용 회색 자리도 상태 문장 하나만 읽히고 그림은 숨긴다", () => {
  render(<LoadingRows variant="detail" label="리포트를 불러오는 중…" count={2} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("리포트를 불러오는 중…");
  expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
});

// [상황] 작은 크기 버튼을 만든다.
// [기대] 손가락 누름 영역을 44px로 넓히는 클래스가 붙는다.
test("작은 버튼은 손가락 누름 영역을 44px로 넓히는 클래스를 가진다", () => {
  expect(buttonVariants({ size: "sm" })).toContain("tap-target");
});

// [상황] 기기에서 "동작 줄이기"를 켠 채 숫자 세기 효과(0 → 42)를 쓴다.
// [기대] 숫자를 세며 올리지 않고 바로 목표 값을 보인다.
test("움직임 줄이기 설정이면 숫자를 세지 않고 바로 목표 값을 보인다", () => {
  const original = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  try {
    const { result, rerender } = renderHook(({ n }) => useCountUp(n), { initialProps: { n: 42 } });
    expect(result.current).toBe(42);
    rerender({ n: 7 });
    expect(result.current).toBe(7);
  } finally {
    window.matchMedia = original;
  }
});

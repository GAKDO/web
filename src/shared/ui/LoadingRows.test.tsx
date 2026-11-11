import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { buttonVariants } from "@/components/ui/button";
import { useCountUp } from "../motion/useCountUp";
import { LoadingRows } from "./LoadingRows";

test("불러오는 동안 회색 자리는 화면 읽기에서 숨기고 상태 문장 하나만 읽힌다", () => {
  render(<LoadingRows label="렌탈 목록을 불러오는 중…" count={3} />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("렌탈 목록을 불러오는 중…");
  expect(status.querySelector("ul")).toHaveAttribute("aria-hidden", "true");
  expect(status.querySelectorAll("li")).toHaveLength(3);
});

test("작은 버튼은 손가락 누름 영역을 44px로 넓히는 클래스를 가진다", () => {
  expect(buttonVariants({ size: "sm" })).toContain("tap-target");
});

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

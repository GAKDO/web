import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Reveal } from "./Reveal";

afterEach(() => vi.unstubAllGlobals());

test("IntersectionObserver가 없는 곳에서는 내용이 처음부터 보인다(숨은 채로 남지 않음)", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Reveal>안녕하세요</Reveal>);
  expect(screen.getByText("안녕하세요")).toHaveAttribute("data-visible", "true");
});

test("스크롤해서 화면에 들어오면 나타난다", () => {
  let fire: (entries: { isIntersecting: boolean }[]) => void = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: typeof fire) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  render(<Reveal as="section">기록</Reveal>);
  const el = screen.getByText("기록");
  expect(el).toHaveAttribute("data-visible", "false");
  act(() => fire([{ isIntersecting: true }]));
  expect(el).toHaveAttribute("data-visible", "true");
});

test("움직임 줄이기 설정이면 처음부터 제자리에 보인다", () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
  render(<Reveal>조용히</Reveal>);
  expect(screen.getByText("조용히")).toHaveAttribute("data-visible", "true");
});

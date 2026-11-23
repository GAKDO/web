// 이 파일이 확인하는 것: 스크롤하면 내용이 나타나는 효과 부품(첫 화면 등)이 내용을 숨긴 채 남기지 않는지.

import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Reveal } from "./Reveal";

afterEach(() => vi.unstubAllGlobals());

// [상황] 화면 들어옴을 알려 주는 브라우저 기능(IntersectionObserver)이 없다.
// [기대] 내용이 처음부터 보인다(영영 숨은 채로 남지 않음).
test("IntersectionObserver가 없는 곳에서는 내용이 처음부터 보인다(숨은 채로 남지 않음)", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Reveal>안녕하세요</Reveal>);
  expect(screen.getByText("안녕하세요")).toHaveAttribute("data-visible", "true");
});

// [상황] 내용이 처음엔 화면 밖에 있다가 스크롤로 들어온다.
// [기대] 처음엔 숨어 있다가 들어오면 나타난다.
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

// [상황] 기기에서 "동작 줄이기"를 켰다.
// [기대] 효과 없이 처음부터 제자리에 보인다.
test("움직임 줄이기 설정이면 처음부터 제자리에 보인다", () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
  render(<Reveal>조용히</Reveal>);
  expect(screen.getByText("조용히")).toHaveAttribute("data-visible", "true");
});

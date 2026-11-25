// 이 파일이 확인하는 것: 첫 화면·설명 화면의 움직이는 설명 그림들이 실제 결과처럼 오해되지 않고, 낭독기에서도 읽히는지.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Camera } from "lucide-react";
import { RecordChain } from "./RecordChain";
import { ScanMotion } from "./ScanMotion";
import { SealSequence } from "./SealSequence";
import { StepTrail, trailOf } from "./StepTrail";

describe("설명용 모션", () => {
  // [상황] 첫 화면의 흠집 탐지 설명 그림을 그린다.
  // [기대] "설명용 그림"이라고 밝히고, 화면 관찰 기능이 없는 곳에서는 바로 최종 상태로 보인다.
  it("홈 흠집 탐지 그림은 설명용 그림이라고 밝히고, 관찰할 수 없는 곳에서는 바로 재생(최종 상태) 상태다", () => {
    render(<ScanMotion />);
    expect(screen.getByRole("img", { name: /설명용 그림/ })).toBeInTheDocument();
    expect(screen.getByText("설명용 그림")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /설명용 그림/ }).closest("figure")).toHaveAttribute("data-motion", "play");
  });

  // [상황] 출고·수령·반납 세 기록 그림을 그린다.
  // [기대] 시점마다 이름이 순서대로 읽히고 "반납 기록 봉인" 표시가 보인다.
  it("세 번의 기록은 시점마다 이름·요약·봉인 표시가 읽힌다", () => {
    render(
      <RecordChain
        records={[
          { name: "출고", icon: Camera, tag: "부스에서 기준 촬영" },
          { name: "수령", icon: Camera, tag: "내 폰으로 상태 촬영" },
          { name: "반납", icon: Camera, tag: "처음 사진과 비교" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("h3")?.textContent)).toEqual(["출고", "수령", "반납"]);
    expect(screen.getByText("반납 기록 봉인")).toBeInTheDocument();
  });

  // [상황] 봉인 확인 그림이 "대조하는 중"이다가 "이상 없음" 결과를 받는다(출고 기록만 있음).
  // [기대] 결과 전에는 성공 문장을 보이지 않고, 결과 뒤에 "봉인된 뒤 바뀐 기록이 없습니다"와 없는 시점의 "기록 없음"이 보인다.
  it("봉인 그림은 결과가 오기 전에는 성공 문장을 보이지 않는다", () => {
    const { rerender, container } = render(<SealSequence state="checking" slots={[{ name: "출고" }, { name: "수령" }, { name: "반납" }]} />);
    expect(container.textContent).toContain("대조하는 중");
    expect(container.textContent).not.toContain("바뀐 기록이 없습니다");
    rerender(<SealSequence state="valid" slots={[{ name: "출고", present: true }, { name: "수령", present: false }, { name: "반납", present: false }]} />);
    expect(container.textContent).toContain("봉인된 뒤 바뀐 기록이 없습니다");
    expect(container.textContent).toContain("기록 없음");
  });

  // [상황] 단계 세 개 중 두 번째가 지금 단계다. 또 모든 단계가 끝났다.
  // [기대] 앞은 끝남, 지금은 진행 중, 뒤는 할 일로 매기고, 다 끝나면 모두 끝남이다.
  it("단계 줄은 지금 단계 앞을 끝남, 지금을 진행 중으로 매긴다", () => {
    expect(trailOf(["a", "b", "c"], 1).map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(trailOf(["a", "b"], 2).map((s) => s.state)).toEqual(["done", "done"]);
  });

  // [상황] 검사 진행 단계 줄이 오류로 멈췄다.
  // [기대] "진행 중" 대신 "멈춤"으로 읽히고 멈춤 표시가 붙는다(깜빡임 끔).
  it("오류·연결 끊김으로 멈춘 단계 줄은 진행 중 대신 멈춤으로 읽히고 깜빡임 표시를 끈다", () => {
    const { rerender, container } = render(<StepTrail steps={trailOf(["촬영", "분석"], 1)} label="검사 진행" />);
    expect(screen.getByRole("group", { name: "검사 진행" })).not.toHaveAttribute("data-stalled");
    expect(container.textContent).toContain("진행 중");
    rerender(<StepTrail steps={trailOf(["촬영", "분석"], 1)} label="검사 진행" stalled />);
    expect(screen.getByRole("group", { name: "검사 진행" })).toHaveAttribute("data-stalled", "true");
    expect(container.textContent).toContain("멈춤");
    expect(container.textContent).not.toContain("진행 중");
  });
});

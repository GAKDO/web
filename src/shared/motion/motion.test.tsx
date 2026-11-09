import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Camera } from "lucide-react";
import { RecordChain } from "./RecordChain";
import { ScanMotion } from "./ScanMotion";
import { SealSequence } from "./SealSequence";
import { StepTrail, trailOf } from "./StepTrail";

describe("설명용 모션", () => {
  it("홈 흠집 탐지 그림은 설명용 그림이라고 밝히고, 관찰할 수 없는 곳에서는 바로 재생(최종 상태) 상태다", () => {
    render(<ScanMotion />);
    expect(screen.getByRole("img", { name: /설명용 그림/ })).toBeInTheDocument();
    expect(screen.getByText("설명용 그림")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /설명용 그림/ }).closest("figure")).toHaveAttribute("data-motion", "play");
  });

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

  it("봉인 그림은 결과가 오기 전에는 성공 문장을 보이지 않는다", () => {
    const { rerender, container } = render(<SealSequence state="checking" slots={[{ name: "출고" }, { name: "수령" }, { name: "반납" }]} />);
    expect(container.textContent).toContain("대조하는 중");
    expect(container.textContent).not.toContain("바뀐 기록이 없습니다");
    rerender(<SealSequence state="valid" slots={[{ name: "출고", present: true }, { name: "수령", present: false }, { name: "반납", present: false }]} />);
    expect(container.textContent).toContain("봉인된 뒤 바뀐 기록이 없습니다");
    expect(container.textContent).toContain("기록 없음");
  });

  it("단계 줄은 지금 단계 앞을 끝남, 지금을 진행 중으로 매긴다", () => {
    expect(trailOf(["a", "b", "c"], 1).map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(trailOf(["a", "b"], 2).map((s) => s.state)).toEqual(["done", "done"]);
  });

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

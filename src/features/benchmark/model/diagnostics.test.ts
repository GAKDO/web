// 이 파일이 확인하는 것: 기기 진단(배터리·SSD 등)의 렌탈 전·후 비교 표시 규칙.

import { changeLevel, formatDelta } from "./diagnostics";

describe("렌탈 전·후 차이 판단", () => {
  // [상황] 전·후 변화율이 −0.4%, ±3%, +6.9%, −8.3%, −14%, 값 없음이다.
  // [기대] 3% 안은 측정 흔들림이라 "비슷함", +6.9%는 "좋아짐", −8.3%는 "조금 떨어짐", −14%(10% 넘게)는 "떨어짐", 값 없음은 판단 안 함.
  it("3% 안의 변화는 측정 흔들림으로 보고 비슷함, 10% 넘게 떨어지면 떨어짐", () => {
    expect(changeLevel(-0.4)).toBe("same");
    expect(changeLevel(3)).toBe("same");
    expect(changeLevel(-3)).toBe("same");
    expect(changeLevel(6.9)).toBe("better");
    expect(changeLevel(-8.3)).toBe("slight");
    expect(changeLevel(-14)).toBe("worse");
    expect(changeLevel(null)).toBeNull();
  });

  // [상황] SSD 사용률처럼 작을수록 좋은 값이 20% 늘거나 줄었다.
  // [기대] 늘면 나빠짐, 줄면 좋아짐으로 본다.
  it("작을수록 좋은 값(SSD 사용률 등)은 늘면 나빠짐으로 본다", () => {
    expect(changeLevel(20, false)).toBe("worse");
    expect(changeLevel(-20, false)).toBe("better");
  });

  // [상황] 속도·비율·횟수의 전·후 값으로 차이를 쓴다.
  // [기대] "후 − 전"을 부호·천 단위 쉼표·단위와 함께 쓴다(같으면 ±0, 값이 없으면 —).
  it("차이는 후 − 전을 부호·단위와 함께 쓴다", () => {
    expect(formatDelta(38696, 35471, "MB/s")).toBe("−3,225 MB/s");
    expect(formatDelta(84.9, 85.7, "%p")).toBe("+0.8%p");
    expect(formatDelta(284, 284, "회")).toBe("±0회");
    expect(formatDelta(null, 3)).toBe("—");
  });
});

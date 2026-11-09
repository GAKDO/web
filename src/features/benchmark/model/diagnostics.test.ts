import { changeLevel, formatDelta } from "./diagnostics";

describe("렌탈 전·후 차이 판단", () => {
  it("3% 안의 변화는 측정 흔들림으로 보고 비슷함, 10% 넘게 떨어지면 떨어짐", () => {
    expect(changeLevel(-0.4)).toBe("same");
    expect(changeLevel(6.9)).toBe("better");
    expect(changeLevel(-8.3)).toBe("slight");
    expect(changeLevel(-14)).toBe("worse");
    expect(changeLevel(null)).toBeNull();
  });

  it("작을수록 좋은 값(SSD 사용률 등)은 늘면 나빠짐으로 본다", () => {
    expect(changeLevel(20, false)).toBe("worse");
    expect(changeLevel(-20, false)).toBe("better");
  });

  it("차이는 후 − 전을 부호·단위와 함께 쓴다", () => {
    expect(formatDelta(38696, 35471, "MB/s")).toBe("−3,225 MB/s");
    expect(formatDelta(84.9, 85.7, "%p")).toBe("+0.8%p");
    expect(formatDelta(284, 284, "회")).toBe("±0회");
    expect(formatDelta(null, 3)).toBe("—");
  });
});

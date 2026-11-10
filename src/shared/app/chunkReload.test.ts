import { isChunkLoadError, shouldReload } from "./chunkReload";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("배포 뒤 지워진 조각 새로 고침", () => {
  test("처음 실패하면 한 번 새로 고치고, 30초 안에 또 실패하면 다시 고치지 않아 대체 안내가 보인다", () => {
    const s = memory();
    expect(shouldReload(100_000, s)).toBe(true);
    expect(shouldReload(110_000, s)).toBe(false);
    expect(shouldReload(140_001, s)).toBe(true);
  });
  test("저장소를 못 쓰면 끝없이 새로 고치지 않도록 고치지 않는다", () => {
    expect(shouldReload(1, null)).toBe(false);
  });
  test("브라우저별 조각 로딩 실패 문구를 알아본다", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://gakdo.site/assets/LaptopViewer-x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

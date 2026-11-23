// 이 파일이 확인하는 것: 새 버전 배포 직후 옛 화면 조각 파일이 지워져 화면이 안 뜰 때 자동 새로 고침하는 규칙.

import { isChunkLoadError, shouldReload } from "./chunkReload";

// 테스트 도구: 브라우저 저장소(sessionStorage) 대신 쓰는 메모리 저장소.
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("배포 뒤 지워진 조각 새로 고침", () => {
  // [상황] 조각 로딩이 처음 실패하고, 10초 뒤 또 실패하고, 처음부터 40초 뒤 또 실패한다.
  // [기대] 처음엔 한 번 새로 고치고, 30초 안의 두 번째 실패는 새로 고치지 않아 대체 안내가 보인다. 30초가 지나면 다시 새로 고친다.
  test("처음 실패하면 한 번 새로 고치고, 30초 안에 또 실패하면 다시 고치지 않아 대체 안내가 보인다", () => {
    const s = memory();
    expect(shouldReload(100_000, s)).toBe(true);
    expect(shouldReload(110_000, s)).toBe(false);
    expect(shouldReload(140_001, s)).toBe(true);
  });
  // [상황] 브라우저 저장소를 쓸 수 없다(사생활 보호 모드 등).
  // [기대] 끝없이 새로 고치지 않도록 아예 새로 고치지 않는다.
  test("저장소를 못 쓰면 끝없이 새로 고치지 않도록 고치지 않는다", () => {
    expect(shouldReload(1, null)).toBe(false);
  });
  // [상황] 크롬·사파리의 조각 로딩 실패 문구와, 상관없는 일반 오류를 넣는다.
  // [기대] 조각 로딩 실패만 알아보고 일반 오류는 아니라고 본다.
  test("브라우저별 조각 로딩 실패 문구를 알아본다", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://gakdo.site/assets/LaptopViewer-x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

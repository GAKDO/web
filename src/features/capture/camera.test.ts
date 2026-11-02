import { stillCrop, viewfinderCrop } from "./camera";

test("가로가 긴 영상(16:9)은 가운데 4:3만 저장한다", () => {
  expect(viewfinderCrop(1920, 1080)).toEqual({ sx: 240, sy: 0, sw: 1440, sh: 1080 });
});

test("세로가 긴 영상(폰 세로 3:4)은 가운데 4:3만 저장한다", () => {
  expect(viewfinderCrop(3024, 4032)).toEqual({ sx: 0, sy: 882, sw: 3024, sh: 2268 });
});

test("이미 4:3이면 자르지 않는다", () => {
  expect(viewfinderCrop(4032, 3024)).toEqual({ sx: 0, sy: 0, sw: 4032, sh: 3024 });
});

test("정지 사진이 영상과 비율이 같으면 화면에 보인 4:3 범위를 사진 해상도로 고른다(줄이지 않음)", () => {
  // 16:9 영상 1920×1080 → 화면 1440×1080. 같은 16:9 사진 3840×2160에서는 2880×2160
  expect(stillCrop(1920, 1080, 3840, 2160)).toEqual({ sx: 480, sy: 0, sw: 2880, sh: 2160 });
});

test("세로로 든 폰(영상·사진 모두 세로 9:16)도 같은 방식으로 고른다", () => {
  expect(stillCrop(1080, 1920, 2160, 3840)).toEqual({ sx: 0, sy: 1110, sw: 2160, sh: 1620 });
});

test("영상과 사진이 모두 4:3이면 사진 전체를 쓴다", () => {
  expect(stillCrop(1440, 1080, 4032, 3024)).toEqual({ sx: 0, sy: 0, sw: 4032, sh: 3024 });
});

test("사진 비율이 영상과 다르면(16:9 영상에 4:3 사진, 방향이 다름) 범위가 같다고 볼 수 없어 정지 사진을 쓰지 않는다", () => {
  expect(stillCrop(1920, 1080, 4000, 3000)).toBeNull();
  expect(stillCrop(1080, 1920, 3840, 2160)).toBeNull();
});

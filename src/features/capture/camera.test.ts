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

test("16:9 영상과 4:3 정지 사진이면 영상에 보인 가운데 4:3 범위를 사진 해상도로 고른다(줄이지 않음)", () => {
  // 영상 1920×1080은 4000×3000 사진의 가운데 4000×2250 범위. 화면에 보인 1440×1080 → 사진 3000×2250
  expect(stillCrop(1920, 1080, 4000, 3000)).toEqual({ sx: 500, sy: 375, sw: 3000, sh: 2250 });
});

test("세로로 든 폰(영상·사진 모두 세로)도 같은 방식으로 고른다", () => {
  // 영상 1080×1920은 3000×4000 사진의 가운데 2250×4000 범위. 화면에 보인 1080×810 → 사진 2250×1688
  expect(stillCrop(1080, 1920, 3000, 4000)).toEqual({ sx: 375, sy: 1156, sw: 2250, sh: 1688 });
});

test("영상과 사진의 비율이 같으면 viewfinderCrop을 사진 크기로 늘린 것과 같다", () => {
  expect(stillCrop(1440, 1080, 4032, 3024)).toEqual({ sx: 0, sy: 0, sw: 4032, sh: 3024 });
});

test("사진이 영상과 다른 방향으로 오면(EXIF 회전 없음 등) 정지 사진을 쓰지 않는다", () => {
  expect(stillCrop(1080, 1920, 4000, 3000)).toBeNull();
});

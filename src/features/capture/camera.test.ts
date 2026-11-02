import { viewfinderCrop } from "./camera";

test("가로가 긴 영상(16:9)은 가운데 4:3만 저장한다", () => {
  expect(viewfinderCrop(1920, 1080)).toEqual({ sx: 240, sy: 0, sw: 1440, sh: 1080 });
});

test("세로가 긴 영상(폰 세로 3:4)은 가운데 4:3만 저장한다", () => {
  expect(viewfinderCrop(3024, 4032)).toEqual({ sx: 0, sy: 882, sw: 3024, sh: 2268 });
});

test("이미 4:3이면 자르지 않는다", () => {
  expect(viewfinderCrop(4032, 3024)).toEqual({ sx: 0, sy: 0, sw: 4032, sh: 3024 });
});

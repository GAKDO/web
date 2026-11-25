// 이 파일이 확인하는 것: 고객이 수령 QR을 찍고 로그인 화면으로 왔을 때 "수령 QR" 안내를 보일지 정하는 규칙.

import { isReceiveQrNext } from "./ReceiveQrNotice";

// [상황] 로그인 뒤 돌아갈 주소가 /capture?t=…(수령 QR), /capture(토큰 없음), /my/rentals, /capturex?t=… 일 때.
// [기대] 수령 QR 주소일 때만 안내를 보인다(비슷한 다른 주소에는 보이지 않음).
test("수령 QR 주소(/capture?t=…)로 돌아갈 때만 수령 QR 안내를 보인다", () => {
  expect(isReceiveQrNext("/capture?t=abc")).toBe(true);
  expect(isReceiveQrNext("/capture")).toBe(false);
  expect(isReceiveQrNext("/my/rentals")).toBe(false);
  expect(isReceiveQrNext("/capturex?t=abc")).toBe(false);
});

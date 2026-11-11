import { isReceiveQrNext } from "./ReceiveQrNotice";

test("수령 QR 주소(/capture?t=…)로 돌아갈 때만 수령 QR 안내를 보인다", () => {
  expect(isReceiveQrNext("/capture?t=abc")).toBe(true);
  expect(isReceiveQrNext("/capture")).toBe(false);
  expect(isReceiveQrNext("/my/rentals")).toBe(false);
  expect(isReceiveQrNext("/capturex?t=abc")).toBe(false);
});

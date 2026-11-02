import { ApiError, networkError, toApiError } from "./problem";

test("Problem Details의 code와 detail을 읽는다", () => {
  const error = toApiError(409, { title: "x", status: 409, code: "DEVICE_NOT_ACTIVE", detail: "수리 중" });
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(409);
  expect(error.code).toBe("DEVICE_NOT_ACTIVE");
  expect(error.detail).toBe("수리 중");
});

test("본문이 Problem Details가 아니면 code와 detail은 null이다", () => {
  const error = toApiError(502, "Bad Gateway");
  expect(error.code).toBeNull();
  expect(error.detail).toBeNull();
});

test("서버에 닿지 못하면 status는 0이다", () => {
  expect(networkError().status).toBe(0);
});

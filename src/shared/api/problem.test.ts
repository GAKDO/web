// 이 파일이 확인하는 것: 서버 오류 응답(Problem Details)을 화면이 읽는 방법. 오류 코드(code)와 설명(detail)으로 사용자에게 알맞은 안내를 보인다.

import { ApiError, networkError, toApiError } from "./problem";

// [상황] 서버가 409와 코드 DEVICE_NOT_ACTIVE, 설명 "수리 중"을 보냈다.
// [기대] 상태 409, 코드, 설명을 그대로 읽는다.
//        ※ 응답 코드: 409 = 지금 상태와 맞지 않아 거절(이미 있음·순서 어긋남 등)
test("Problem Details의 code와 detail을 읽는다", () => {
  const error = toApiError(409, { title: "x", status: 409, code: "DEVICE_NOT_ACTIVE", detail: "수리 중" });
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(409);
  expect(error.code).toBe("DEVICE_NOT_ACTIVE");
  expect(error.detail).toBe("수리 중");
});

// [상황] 게이트웨이가 502와 "Bad Gateway" 글자만 보냈다.
// [기대] 코드와 설명은 없음(null)으로 둔다.
//        ※ 응답 코드: 502 = 중간 서버가 뒤쪽 서버에서 잘못된 응답을 받음
test("본문이 Problem Details가 아니면 code와 detail은 null이다", () => {
  const error = toApiError(502, "Bad Gateway");
  expect(error.code).toBeNull();
  expect(error.detail).toBeNull();
});

// [상황] 네트워크가 끊겨 서버에 닿지 못했다.
// [기대] 상태를 0으로 둔다(화면이 "연결 실패"로 안내할 수 있게).
test("서버에 닿지 못하면 status는 0이다", () => {
  expect(networkError().status).toBe(0);
});

// 이 파일이 확인하는 것: 고객 리포트 화면의 사진 주소 갱신 시점과, 가짜 서버(목)가 고객 권한을 진짜 서버처럼 지키는지.

import { api, unwrap } from "../../../shared/api/client";
import { tokenStore } from "../../../shared/auth/tokenStore";
import { MOCK_CUSTOMER, db } from "../../../shared/mocks/db";
import { mediaRefreshMs } from "./report";

// 테스트 도구: 시험용 고객 계정으로 로그인해 토큰을 저장한다.
async function loginAsCustomer() {
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: { ...MOCK_CUSTOMER } })));
}

// [상황] 사진 보기 주소(사전 서명 URL)의 만료가 10분 뒤, 30초 뒤다.
// [기대] 만료 1분 전(9분 뒤)에 새로 받고, 이미 1분 안이면 5초 뒤에 받는다.
test("사진 보기 주소는 만료 1분 전에 새로 받는다", () => {
  const now = Date.parse("2026-11-12T13:00:00Z");
  expect(mediaRefreshMs("2026-11-12T13:10:00Z", now)).toBe(9 * 60_000);
  expect(mediaRefreshMs("2026-11-12T13:00:30Z", now)).toBe(5_000);
});

// [상황] 고객으로 로그인해 렌탈 목록과 내 정보를 읽는다.
// [기대] 자기 렌탈만 받는다.
test("고객은 목에서 자기 렌탈만 목록·내 정보로 받는다", async () => {
  await loginAsCustomer();
  const page = await unwrap(api.GET("/api/v1/rentals", { params: { query: { limit: 50 } } }));
  const me = await unwrap(api.GET("/api/v1/auth/me"));
  expect(page.items.map((r) => r.rentalId).sort()).toEqual([...db.report.owners.keys()].sort());
  expect(me.rentalIds.sort()).toEqual([...db.report.owners.keys()].sort());
});

// [상황] 고객이 남의 렌탈 리포트·검사 결과·진단을 읽으려 한다.
// [기대] 모두 403(리포트는 OUT_OF_SCOPE)이다.
//        ※ 응답 코드: 403 = 권한 없음(누구인지는 알지만 허락되지 않은 일)
test("고객이 다른 고객의 리포트·검사·진단을 읽으면 목이 403 OUT_OF_SCOPE를 준다", async () => {
  await loginAsCustomer();
  const [rentalId] = [...db.report.owners.keys()];
  const checkpointId = db.report.timelines.get(rentalId)?.checkpoints[0].checkpointId ?? "";
  db.report.owners.set(rentalId, "someone-else-000000000");
  await expect(unwrap(api.GET("/api/v1/reports/rentals/{rentalId}", { params: { path: { rentalId } } }))).rejects.toMatchObject({ status: 403, code: "OUT_OF_SCOPE" });
  await expect(unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/inspection", { params: { path: { checkpointId } } }))).rejects.toMatchObject({ status: 403 });
  await expect(unwrap(api.GET("/api/v1/diagnostics/checkpoints/{checkpointId}", { params: { path: { checkpointId } } }))).rejects.toMatchObject({ status: 403 });
});

import { api, unwrap } from "../../../shared/api/client";
import { tokenStore } from "../../../shared/auth/tokenStore";
import { MOCK_CUSTOMER, db } from "../../../shared/mocks/db";
import { mediaRefreshMs } from "./report";

async function loginAsCustomer() {
  tokenStore.set(await unwrap(api.POST("/api/v1/auth/login", { body: { ...MOCK_CUSTOMER } })));
}

test("사진 보기 주소는 만료 1분 전에 새로 받는다", () => {
  const now = Date.parse("2026-11-12T13:00:00Z");
  expect(mediaRefreshMs("2026-11-12T13:10:00Z", now)).toBe(9 * 60_000);
  expect(mediaRefreshMs("2026-11-12T13:00:30Z", now)).toBe(5_000);
});

test("고객은 목에서 자기 렌탈만 목록·내 정보로 받는다", async () => {
  await loginAsCustomer();
  const page = await unwrap(api.GET("/api/v1/rentals", { params: { query: { limit: 50 } } }));
  const me = await unwrap(api.GET("/api/v1/auth/me"));
  expect(page.items.map((r) => r.rentalId).sort()).toEqual([...db.report.owners.keys()].sort());
  expect(me.rentalIds.sort()).toEqual([...db.report.owners.keys()].sort());
});

test("고객이 다른 고객의 리포트·검사·진단을 읽으면 목이 403 OUT_OF_SCOPE를 준다", async () => {
  await loginAsCustomer();
  const [rentalId] = [...db.report.owners.keys()];
  const checkpointId = db.report.timelines.get(rentalId)?.checkpoints[0].checkpointId ?? "";
  db.report.owners.set(rentalId, "someone-else-000000000");
  await expect(unwrap(api.GET("/api/v1/reports/rentals/{rentalId}", { params: { path: { rentalId } } }))).rejects.toMatchObject({ status: 403, code: "OUT_OF_SCOPE" });
  await expect(unwrap(api.GET("/api/v1/captures/checkpoints/{checkpointId}/inspection", { params: { path: { checkpointId } } }))).rejects.toMatchObject({ status: 403 });
  await expect(unwrap(api.GET("/api/v1/diagnostics/checkpoints/{checkpointId}", { params: { path: { checkpointId } } }))).rejects.toMatchObject({ status: 403 });
});

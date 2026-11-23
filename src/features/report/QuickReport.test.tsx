// 이 파일이 확인하는 것: 부스 빠른 검사만 한 렌탈의 리포트 화면.

import { screen } from "@testing-library/react";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// [상황] 출고를 부스 빠른 검사로만 찍은 렌탈(R-1002)의 리포트를 관리자가 연다.
// [기대] 9면 펼친 그림 대신 "부스 사진 · 출고" 칸에 부스 원본 사진 12장과 흠집 표시 3개가 보이고, "사진 없음"은 나오지 않는다.
test("부스 빠른 검사만 있는 렌탈의 리포트는 9면 대신 부스 원본 사진 12장과 흠집 표시를 보여 준다", async () => {
  const quick = db.rentals.find((r) => r.renterRef === "R-1002")!;
  const cp = quick.checkpoints[0];
  const device = db.devices.find((d) => d.deviceId === quick.deviceId)!;
  db.report.timelines.set(quick.rentalId, {
    rentalId: quick.rentalId, modelCode: device.modelCode, chainStatus: "VALID",
    verifyUrl: "https://gakdo.site/verify/0123456789abcdef0123456789abcdef",
    checkpoints: [{ checkpointId: cp.checkpointId, type: "OUT", status: "SEALED", occurredAt: cp.occurredAt, grade: "C", newDefectCount: 0, pins: [], diagnosticsSummary: null, sealedAt: cp.occurredAt }],
  });
  renderAsAdmin(`/my/rentals/${quick.rentalId}`);
  expect(await screen.findByRole("heading", { name: "부스 사진 · 출고" })).toBeInTheDocument();
  expect(await screen.findByText("부스에서 찍은 사진 12장 · 사진 속 표시 3개")).toBeInTheDocument();
  expect(screen.queryByText("사진 없음")).not.toBeInTheDocument();
});

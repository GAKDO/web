import { screen } from "@testing-library/react";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

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
  expect(await screen.findByText("부스에서 찍은 사진 12장 · 흠집 표시 3곳")).toBeInTheDocument();
  expect(screen.queryByText("사진 없음")).not.toBeInTheDocument();
});

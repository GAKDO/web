// 리포트 QR로 공개 검증(FR-INT-0x): 리포트의 공개 검증 주소가 QR 이미지로도 보이는지 본다
import { screen } from "@testing-library/react";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { verifyQrDataUrl } from "./components/VerifyQr";

function firstRentalId(): string {
  return [...db.report.owners.keys()][0];
}

test("리포트를 열면 '기록 검증하기'와 같은 검증 주소로 그린 QR 이미지가 보인다", async () => {
  const rentalId = firstRentalId();
  const verifyUrl = db.report.timelines.get(rentalId)?.verifyUrl;
  if (!verifyUrl) throw new Error("목 검증 주소 없음");
  renderAsCustomer(`/my/rentals/${rentalId}`);
  const img = await screen.findByRole("img", { name: "기록 검증 QR" });
  expect(img).toHaveAttribute("src", await verifyQrDataUrl(verifyUrl));
  expect(screen.getByRole("link", { name: "기록 검증하기" })).toHaveAttribute("href", verifyUrl);
  expect(screen.getByRole("link", { name: verifyUrl })).toHaveAttribute("href", verifyUrl);
});

test("검증 주소가 다르면 QR도 다른 그림이 된다", async () => {
  const a = await verifyQrDataUrl("https://trace.example.com/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const b = await verifyQrDataUrl("https://trace.example.com/verify/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  expect(a).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  expect(a).not.toBe(b);
});

test("검증 주소가 없는 리포트는 QR도 '기록 검증하기'도 보이지 않는다", async () => {
  const rentalId = firstRentalId();
  const timeline = db.report.timelines.get(rentalId);
  if (!timeline) throw new Error("목 타임라인 없음");
  db.report.timelines.set(rentalId, { ...timeline, verifyUrl: null });
  renderAsCustomer(`/my/rentals/${rentalId}`);
  await screen.findByRole("list", { name: "시점" });
  expect(screen.queryByRole("img", { name: "기록 검증 QR" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "검증 QR" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "기록 검증하기" })).not.toBeInTheDocument();
});

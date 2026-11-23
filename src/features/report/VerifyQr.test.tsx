// 이 파일이 확인하는 것: 리포트의 "기록 검증" QR. 누구나 QR을 찍어 이 기록이 위조되지 않았는지 공개 검증 화면에서 확인할 수 있다.

// 리포트 QR로 공개 검증(FR-INT-0x): 리포트의 공개 검증 주소가 QR 이미지로도 보이는지 본다
import { screen } from "@testing-library/react";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { verifyQrDataUrl } from "./components/VerifyQr";

// 테스트 도구: 가짜 데이터에서 고객이 가진 첫 렌탈 ID를 꺼낸다.
function firstRentalId(): string {
  return [...db.report.owners.keys()][0];
}

// [상황] 고객이 자기 렌탈 리포트를 연다.
// [기대] "기록 검증하기" 링크, 주소 글자 링크, QR 그림이 모두 같은 검증 주소를 가리킨다.
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

// [상황] 서로 다른 두 검증 주소로 QR을 만든다.
// [기대] 둘 다 SVG 그림이고 서로 다른 그림이다.
test("검증 주소가 다르면 QR도 다른 그림이 된다", async () => {
  const a = await verifyQrDataUrl("https://trace.example.com/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const b = await verifyQrDataUrl("https://trace.example.com/verify/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  expect(a).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  expect(a).not.toBe(b);
});

// [상황] 검증 주소가 아직 없는 리포트를 연다.
// [기대] QR도, 검증 칸도, "기록 검증하기" 링크도 보이지 않는다(빈 QR을 보여 주지 않음).
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

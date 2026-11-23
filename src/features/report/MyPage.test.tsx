// 이 파일이 확인하는 것: 고객 마이페이지(내 노트북 목록)와 내 정보 화면.

import { screen, within } from "@testing-library/react";
import { renderAsCustomer } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// [상황] 고객으로 로그인해 마이페이지를 연다.
// [기대] 빌린 LG gram 16 카드에 CPU·메모리·저장 공간·그래픽 사양이 보이고, 시리얼은 전체가 아닌 뒤 4자리만 보인다.
//        출고·수령·반납 검사 단계 3칸이 보인다.
test("마이페이지에서 내 노트북 카드마다 기종 사양과 가린 시리얼, 출고·수령·반납 단계가 보인다", async () => {
  renderAsCustomer("/my/rentals");
  expect(await screen.findByRole("heading", { level: 1, name: "마이페이지" })).toBeInTheDocument();
  const gram = await screen.findByRole("listitem", { name: "LG gram 16 (2024)" });
  expect(await within(gram).findByText("Intel Core Ultra 7 155H")).toBeInTheDocument();
  expect(within(gram).getByText("16GB")).toBeInTheDocument();
  expect(within(gram).getByText("512GB SSD")).toBeInTheDocument();
  expect(within(gram).getByText("Intel Arc Graphics")).toBeInTheDocument();
  const device = db.rentals
    .filter((r) => db.report.owners.has(r.rentalId))
    .map((r) => db.devices.find((d) => d.deviceId === r.deviceId))
    .find((d) => d?.modelCode === "LG-GRAM16");
  if (!device) throw new Error("목 기기 없음");
  const rental = { serial: device.serial };
  // 시리얼 전체는 화면에 없고 뒤 4자리만
  expect(within(gram).queryByText(rental.serial)).not.toBeInTheDocument();
  expect(within(gram).getByText(new RegExp(`${rental.serial.slice(-4)}$`))).toBeInTheDocument();
  const steps = within(gram).getByRole("list", { name: "검사 단계" });
  expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
});

// [상황] 마이페이지 위쪽 요약 칸을 본다.
// [기대] "연결된 노트북" 수(2대)는 내 정보의 렌탈 ID 목록에서 읽는다.
test("마이페이지 요약의 연결된 노트북 수는 내 정보(rentalIds)에서 읽는다", async () => {
  renderAsCustomer("/my/rentals");
  const linked = (await screen.findByText("연결된 노트북")).closest("div");
  if (!linked) throw new Error("요약 칸 없음");
  expect(await within(linked as HTMLElement).findByText("2대")).toBeInTheDocument();
});

// [상황] 고객이 내 정보 화면을 연다.
// [기대] 이메일이 보이고, "비밀번호 바꾸기"와 "탈퇴하기"로 가는 링크가 있다.
test("내 정보에서 이름·이메일을 보고, 비밀번호 바꾸기와 탈퇴로 갈 수 있다", async () => {
  renderAsCustomer("/my/account");
  expect(await screen.findByRole("heading", { level: 1, name: "내 정보" })).toBeInTheDocument();
  expect(await screen.findByText("renter@example.com")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "비밀번호 바꾸기" })).toHaveAttribute("href", "/password/reset");
  expect(screen.getByRole("link", { name: "탈퇴하기" })).toHaveAttribute("href", "/my/account/withdraw");
});

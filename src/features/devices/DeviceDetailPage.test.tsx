// 이 파일이 확인하는 것: 관리 화면의 기기 상세. 기기 정보와 그 기기의 렌탈 이력, 가려진 시리얼 보기,
// "이 기기로 렌탈 만들기"로 렌탈 만들기 화면에 기기를 넘기는 흐름을 본다.

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";

// 테스트 도구: 가짜 데이터에서 시리얼로 기기 하나를 찾는다.
const deviceOf = (serial: string) => db.devices.find((d) => d.serial === serial)!;

// [상황] 렌탈 이력이 있는 기기 C02PRO0001의 상세를 연다.
// [기대] 제목에 시리얼 끝 4자리만 보이고(••••••0001), 렌탈 이력에는 이 기기의 렌탈만 빠짐없이 나온다.
test("기기 상세를 열면 기기 정보와 그 기기의 렌탈 이력만 보인다", async () => {
  const device = deviceOf("C02PRO0001");
  const expected = db.rentals.filter((r) => r.deviceId === device.deviceId);
  renderAsAdmin(`/admin/devices/${device.deviceId}`);
  expect(await screen.findByRole("heading", { name: "기기 ••••••0001" })).toBeInTheDocument();
  const history = await screen.findByRole("list", { name: "렌탈 이력" });
  const rows = await within(history).findAllByRole("listitem");
  expect(rows).toHaveLength(expected.length);
  expect(rows.map((li) => li.getAttribute("aria-label")).sort()).toEqual(expected.map((r) => r.renterRef).sort());
});

// [상황] 렌탈한 적 없는 기기의 상세를 연다.
// [기대] "이 기기는 아직 렌탈한 적이 없습니다."가 보인다.
test("렌탈한 적 없는 기기는 이력이 없다는 문장이 보인다", async () => {
  renderAsAdmin(`/admin/devices/${deviceOf("C02AIR0002").deviceId}`);
  expect(await screen.findByText("이 기기는 아직 렌탈한 적이 없습니다.")).toBeInTheDocument();
});

// [상황] 기기 상세의 렌탈 이력에서 R-1001을 누른다.
// [기대] 그 렌탈의 상세 화면으로 간다.
test("이력 행을 누르면 그 렌탈 상세로 간다", async () => {
  const user = userEvent.setup();
  const device = deviceOf("C02AIR0001");
  renderAsAdmin(`/admin/devices/${device.deviceId}`);
  await user.click(await screen.findByRole("link", { name: "R-1001" }));
  expect(await screen.findByRole("heading", { name: /렌탈 ••••••0001/ })).toBeInTheDocument();
});

// [상황] 기기 목록에서 시리얼 C02AIR0001을 누른다.
// [기대] 그 기기의 상세 화면으로 간다.
test("기기 목록에서 시리얼을 누르면 기기 상세로 간다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await user.click(await screen.findByRole("link", { name: "C02AIR0001" }));
  expect(await screen.findByRole("heading", { name: "기기 ••••••0001" })).toBeInTheDocument();
});

// [상황] 없는 기기 번호로 상세 주소를 연다.
// [기대] 오류 문장이 보인다.
test("없는 기기 주소는 오류 문장을 보인다", async () => {
  renderAsAdmin("/admin/devices/AAAAAAAAAAAAAAAAAAAAA");
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

// [상황] 기기 상세에서 눈 아이콘("시리얼 보기")을 눌렀다가 다시 누른다.
// [기대] 처음엔 시리얼 전체가 안 보이고, 누르면 전체가 보이며, 다시 누르면 가려진다(옆 사람에게 시리얼 노출 방지).
test("기기 상세의 시리얼은 가려져 있다가 눈 아이콘을 누르면 전체가 보이고, 다시 누르면 가려진다", async () => {
  const user = userEvent.setup();
  renderAsAdmin(`/admin/devices/${deviceOf("C02PRO0001").deviceId}`);
  await screen.findByRole("heading", { name: "기기 ••••••0001" });
  expect(screen.queryByText("C02PRO0001")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "시리얼 보기" }));
  expect(screen.getByText("C02PRO0001")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "시리얼 가리기" }));
  expect(screen.queryByText("C02PRO0001")).not.toBeInTheDocument();
});

// [상황] 기기 상세에서 "이 기기로 렌탈 만들기"를 누른다.
// [기대] 렌탈 만들기 화면이 열리고 기기 칸에 그 기기가 이미 골라져 있다.
test("기기 상세에서 '이 기기로 렌탈 만들기'를 누르면 렌탈 만들기 화면에 그 기기가 골라져 있다", async () => {
  const user = userEvent.setup();
  const device = deviceOf("C02AIR0002");
  renderAsAdmin(`/admin/devices/${device.deviceId}`);
  await user.click(await screen.findByRole("link", { name: "이 기기로 렌탈 만들기" }));
  await waitFor(() => expect(screen.getByLabelText("기기")).toHaveValue(device.deviceId));
});

// [상황] 사용 가능 기기가 많아 렌탈 만들기 화면의 기기 목록 첫 쪽(100대)에 넘겨받은 기기가 빠져 있다.
// [기대] 그래도 선택지에 그 기기가 보이고 골라져 있다.
test("넘겨받은 기기가 기기 목록 첫 쪽에 없어도 렌탈 만들기 선택지에 그 기기가 보이고 골라져 있다", async () => {
  const user = userEvent.setup();
  const device = deviceOf("C02AIR0002");
  // 사용 가능 기기가 100대를 넘어 첫 쪽에 이 기기가 빠진 경우
  server.use(
    http.get("*/api/v1/devices", () =>
      HttpResponse.json({ items: db.devices.filter((d) => d.deviceId !== device.deviceId), nextCursor: "100" }),
    ),
  );
  renderAsAdmin(`/admin/devices/${device.deviceId}`);
  await user.click(await screen.findByRole("link", { name: "이 기기로 렌탈 만들기" }));
  const select = await screen.findByLabelText("기기");
  await waitFor(() => expect(select).toHaveValue(device.deviceId));
  expect(within(select).getByRole("option", { selected: true })).toHaveValue(device.deviceId);
});

// [상황] 새로 고침 등으로 기기 정보가 화면에 없고, 목록 첫 쪽에도 없으며, 기기 조회마저 서버 오류(500)로 실패한다.
// [기대] 오류와 "다시 시도" 버튼이 보이고, 대여자 번호를 넣어도 "렌탈 만들기"는 눌리지 않는다(엉뚱한 기기로 만들지 않게).
//        ※ 응답 코드: 500 = 서버 내부 오류
test("넘겨받은 기기를 읽지 못하면 오류와 다시 시도가 보이고 렌탈 만들기 버튼은 눌리지 않는다", async () => {
  const user = userEvent.setup();
  const device = deviceOf("C02AIR0002");
  // 새로 고침 등으로 기기 상세 캐시가 없고, 첫 쪽 목록에도 없고, 상세 조회가 실패한 경우
  server.use(
    http.get("*/api/v1/devices", () =>
      HttpResponse.json({ items: db.devices.filter((d) => d.deviceId !== device.deviceId), nextCursor: "100" }),
    ),
    http.get("*/api/v1/devices/:deviceId", () => new HttpResponse(null, { status: 500 })),
  );
  const { router } = renderAsAdmin("/admin/rentals");
  await act(() => router.navigate("/admin/rentals/new", { state: { deviceId: device.deviceId } }));
  expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  await user.type(screen.getByLabelText("대여자 참조 번호"), "R-1");
  expect(screen.getByRole("button", { name: "렌탈 만들기" })).toBeDisabled();
});

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

const deviceOf = (serial: string) => db.devices.find((d) => d.serial === serial)!;

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

test("렌탈한 적 없는 기기는 이력이 없다는 문장이 보인다", async () => {
  renderAsAdmin(`/admin/devices/${deviceOf("C02AIR0002").deviceId}`);
  expect(await screen.findByText("이 기기는 아직 렌탈한 적이 없습니다.")).toBeInTheDocument();
});

test("이력 행을 누르면 그 렌탈 상세로 간다", async () => {
  const user = userEvent.setup();
  const device = deviceOf("C02AIR0001");
  renderAsAdmin(`/admin/devices/${device.deviceId}`);
  await user.click(await screen.findByRole("link", { name: "R-1001" }));
  expect(await screen.findByRole("heading", { name: /렌탈 ••••••0001/ })).toBeInTheDocument();
});

test("기기 목록에서 시리얼을 누르면 기기 상세로 간다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await user.click(await screen.findByRole("link", { name: "C02AIR0001" }));
  expect(await screen.findByRole("heading", { name: "기기 ••••••0001" })).toBeInTheDocument();
});

test("없는 기기 주소는 오류 문장을 보인다", async () => {
  renderAsAdmin("/admin/devices/AAAAAAAAAAAAAAAAAAAAA");
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

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

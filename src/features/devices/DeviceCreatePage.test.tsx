import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

async function openForm() {
  const user = userEvent.setup();
  const view = renderAsAdmin("/admin/devices/new");
  await screen.findByRole("heading", { name: "기기 등록" });
  return { user, ...view };
}

test("기기 등록 화면에서 기종 선택 목록을 열면 등록된 기종이 모두 보인다", async () => {
  await openForm();
  const select = screen.getByLabelText("기종");
  await waitFor(() =>
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "기종을 고르세요",
      "MacBook Air (M2, 2022)",
      "MacBook Pro 14 (M3, 2023)",
      "LG gram 16 (2024)",
    ]),
  );
});

async function fill(user: ReturnType<typeof userEvent.setup>, serial: string) {
  await user.type(screen.getByLabelText("시리얼"), serial);
  await waitFor(() => expect(within(screen.getByLabelText("기종")).getAllByRole("option")).toHaveLength(4));
  await user.selectOptions(screen.getByLabelText("기종"), "MacBook Air (M2, 2022)");
  await user.click(screen.getByRole("button", { name: "등록" }));
}

test("새 시리얼로 등록하면 기기 목록으로 돌아가고 새 기기가 보인다", async () => {
  const { user, router } = await openForm();
  await fill(user, "C02AIR0099");
  expect(await screen.findByRole("listitem", { name: "C02AIR0099" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/devices");
  expect(db.devices.find((d) => d.serial === "C02AIR0099")?.status).toBe("ACTIVE");
});

test("이미 있는 시리얼로 등록하면 409가 이미 등록된 시리얼이라는 문장으로 보인다", async () => {
  const { user } = await openForm();
  await fill(user, "C02AIR0001");
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 시리얼입니다. 시리얼을 다시 확인해 주세요.");
});

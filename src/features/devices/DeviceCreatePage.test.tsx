import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// 테스트에선 tesseract.js(wasm)를 돌리지 않고 OCR 결과 글자만 바꿔 끼운다
const { readLabelText } = vi.hoisted(() => ({ readLabelText: vi.fn<(file: Blob) => Promise<string>>() }));
vi.mock("./lib/ocr", () => ({ readLabelText }));

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

test("라벨 사진을 고르면 읽은 시리얼·기종이 칸에 미리 채워지고 고친 뒤 등록할 수 있다", async () => {
  readLabelText.mockResolvedValueOnce("Designed by Apple in California\nModel A2681 EMC 4048\nSerial: C02LBL0077");
  const { user } = await openForm();
  await waitFor(() => expect(within(screen.getByLabelText("기종")).getAllByRole("option")).toHaveLength(4));
  await user.upload(screen.getByLabelText("라벨 사진"), new File(["x"], "label.jpg", { type: "image/jpeg" }));
  expect(await screen.findByText(/사진에서 읽은 값: 시리얼 C02LBL0077, 모델 번호 A2681/)).toBeInTheDocument();
  expect(screen.getByLabelText("시리얼")).toHaveValue("C02LBL0077");
  expect(screen.getByLabelText("기종")).toHaveValue("MBA13-M2");
  expect(screen.getByLabelText("OS")).toHaveValue("MACOS");
  // 관리자가 OCR이 헷갈린 글자를 고친 뒤 등록한다
  await user.clear(screen.getByLabelText("시리얼"));
  await user.type(screen.getByLabelText("시리얼"), "C02LBL0O77");
  await user.click(screen.getByRole("button", { name: "등록" }));
  expect(await screen.findByRole("listitem", { name: "C02LBL0O77" })).toBeInTheDocument();
});

test("라벨 글자를 못 읽으면 칸을 비워 두고 직접 입력하라고 알린다", async () => {
  readLabelText.mockRejectedValueOnce(new Error("no wasm"));
  const { user } = await openForm();
  await user.upload(screen.getByLabelText("저장된 라벨 사진"), new File(["x"], "label.jpg", { type: "image/jpeg" }));
  expect(await screen.findByText("사진의 글자를 읽지 못했습니다. 직접 입력하거나 다시 찍어 주세요.")).toBeInTheDocument();
  expect(screen.getByLabelText("시리얼")).toHaveValue("");
});

test("기종 목록이 오기 전에 라벨을 다 읽어도 목록이 오면 기종이 채워진다", async () => {
  readLabelText.mockResolvedValueOnce("Model A2681\nSerial: C02LBL0088");
  const { user } = await openForm();
  // 기종 목록을 기다리지 않고 바로 올린다
  await user.upload(screen.getByLabelText("라벨 사진"), new File(["x"], "label.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(screen.getByLabelText("기종")).toHaveValue("MBA13-M2"));
});

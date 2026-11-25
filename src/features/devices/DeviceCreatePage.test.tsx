// 이 파일이 확인하는 것: 관리자의 기기 등록 화면. 시리얼과 기종을 넣어 새 노트북을 등록하고,
// 노트북 바닥 라벨 사진을 고르면 글자 읽기(OCR)로 시리얼·기종을 미리 채워 준다.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

// 테스트에선 tesseract.js(wasm)를 돌리지 않고 OCR 결과 글자만 바꿔 끼운다
const { readLabelText } = vi.hoisted(() => ({ readLabelText: vi.fn<(file: Blob) => Promise<string>>() }));
vi.mock("./lib/ocr", () => ({ readLabelText }));

// 테스트 도구: 관리자로 기기 등록 화면을 연다.
async function openForm() {
  const user = userEvent.setup();
  const view = renderAsAdmin("/admin/devices/new");
  await screen.findByRole("heading", { name: "기기 등록" });
  return { user, ...view };
}

// [상황] 기기 등록 화면에서 기종 선택 목록을 연다.
// [기대] 안내 문구와 등록된 기종 3개(MacBook Air M2, MacBook Pro 14 M3, LG gram 16)가 보인다.
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

// 테스트 도구: 시리얼을 넣고, 기종 목록이 오면 MacBook Air (M2)를 골라 "등록"을 누른다.
async function fill(user: ReturnType<typeof userEvent.setup>, serial: string) {
  await user.type(screen.getByLabelText("시리얼"), serial);
  await waitFor(() => expect(within(screen.getByLabelText("기종")).getAllByRole("option")).toHaveLength(4));
  await user.selectOptions(screen.getByLabelText("기종"), "MacBook Air (M2, 2022)");
  await user.click(screen.getByRole("button", { name: "등록" }));
}

// [상황] 처음 보는 시리얼 C02AIR0099로 등록한다.
// [기대] 기기 목록으로 돌아가 새 기기가 보이고, 상태는 사용 중(ACTIVE)이다.
test("새 시리얼로 등록하면 기기 목록으로 돌아가고 새 기기가 보인다", async () => {
  const { user, router } = await openForm();
  await fill(user, "C02AIR0099");
  expect(await screen.findByRole("listitem", { name: "C02AIR0099" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/devices");
  expect(db.devices.find((d) => d.serial === "C02AIR0099")?.status).toBe("ACTIVE");
});

// [상황] 이미 등록된 시리얼 C02AIR0001로 다시 등록한다.
// [기대] 서버의 409(중복)가 "이미 등록된 시리얼입니다. 시리얼을 다시 확인해 주세요."로 보인다.
//        ※ 응답 코드: 409 = 지금 상태와 맞지 않아 거절(이미 있음·순서 어긋남 등)
test("이미 있는 시리얼로 등록하면 409가 이미 등록된 시리얼이라는 문장으로 보인다", async () => {
  const { user } = await openForm();
  await fill(user, "C02AIR0001");
  expect(await screen.findByRole("alert")).toHaveTextContent("이미 등록된 시리얼입니다. 시리얼을 다시 확인해 주세요.");
});

// [상황] 라벨 사진을 고르고, 글자 읽기 결과에 모델 번호 A2681과 시리얼이 있다. 관리자가 시리얼 한 글자를 고친다.
// [기대] 읽은 값 안내와 함께 시리얼, 기종(MBA13-M2), OS(macOS)가 미리 채워진다. 고친 시리얼로 등록된다.
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

// [상황] 저장된 라벨 사진을 골랐지만 글자 읽기가 실패한다.
// [기대] "사진의 글자를 읽지 못했습니다. 직접 입력하거나 다시 찍어 주세요."가 보이고 시리얼 칸은 비어 있다.
test("라벨 글자를 못 읽으면 칸을 비워 두고 직접 입력하라고 알린다", async () => {
  readLabelText.mockRejectedValueOnce(new Error("no wasm"));
  const { user } = await openForm();
  await user.upload(screen.getByLabelText("저장된 라벨 사진"), new File(["x"], "label.jpg", { type: "image/jpeg" }));
  expect(await screen.findByText("사진의 글자를 읽지 못했습니다. 직접 입력하거나 다시 찍어 주세요.")).toBeInTheDocument();
  expect(screen.getByLabelText("시리얼")).toHaveValue("");
});

// [상황] 기종 목록이 서버에서 오기 전에 라벨 사진을 올려 글자 읽기가 먼저 끝난다.
// [기대] 나중에 기종 목록이 오면 기종 칸이 MBA13-M2로 채워진다(순서가 바뀌어도 값을 잃지 않음).
test("기종 목록이 오기 전에 라벨을 다 읽어도 목록이 오면 기종이 채워진다", async () => {
  readLabelText.mockResolvedValueOnce("Model A2681\nSerial: C02LBL0088");
  const { user } = await openForm();
  // 기종 목록을 기다리지 않고 바로 올린다
  await user.upload(screen.getByLabelText("라벨 사진"), new File(["x"], "label.jpg", { type: "image/jpeg" }));
  await waitFor(() => expect(screen.getByLabelText("기종")).toHaveValue("MBA13-M2"));
});

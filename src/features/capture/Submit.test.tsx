import { act, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { renderApp } from "../../test/renderApp";
import { captureDb, MOCK_STORAGE_ORIGIN, mockCaptureLink } from "../../shared/mocks/captureDb";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import * as camera from "./camera";
import { hashedShot } from "./testing";

vi.mock("./camera", async (importOriginal) => {
  const real = await importOriginal<typeof import("./camera")>();
  return { ...real, isSecure: vi.fn(() => true), hasCameraApi: vi.fn(() => true), openCamera: vi.fn(async () => ({}) as MediaStream), attachStream: vi.fn(), stopCamera: vi.fn(), captureShot: vi.fn() };
});

let counter = 0;
let app: ReturnType<typeof renderApp>;
beforeEach(() => {
  counter = 0;
  vi.mocked(camera.captureShot).mockImplementation(() => hashedShot(++counter));
  db.refreshAccount = db.accounts.find((a) => a.role === "CUSTOMER") ?? null;
});

/** 윗면부터 필수 7면을 차례로 찍어 통과시킨다(통과하면 다음 면이 자동으로 열림) */
async function shootRequired(rentalId?: string): Promise<UserEvent> {
  const user = userEvent.setup();
  app = renderApp(`/capture?t=${mockCaptureLink(rentalId).token}`);
  await user.click(await screen.findByRole("button", { name: /^윗면/ }));
  for (let i = 0; i < 7; i++) {
    await user.click(await screen.findByRole("button", { name: "찍기" }));
    await user.click(await screen.findByRole("button", { name: "이 사진 쓰기" }));
  }
  await screen.findByText("필수 면을 모두 찍었습니다.");
  return user;
}

const submitButton = () => within(screen.getByRole("region", { name: "제출" })).getByRole("button");

test("필수 면 중 하나라도 통과하지 않았으면 제출 버튼이 꺼져 있고 남은 면 이름이 보인다", async () => {
  renderApp(`/capture?t=${mockCaptureLink().token}`);
  expect(await screen.findByText(/남은 필수 면: 윗면\(덮개\), 바닥/)).toBeInTheDocument();
  expect(submitButton()).toBeDisabled();
});

test("필수 7면을 통과하고 흰 화면을 건너뛰면 이유와 함께 제출되고, 접수 화면이 보이며 다시 제출할 수 없다", async () => {
  const user = await shootRequired();
  expect(screen.getByLabelText("화면(흰색)을 찍지 않은 이유")).toHaveValue("화면이 켜지지 않음");
  await user.click(submitButton());
  expect(await screen.findByText(/수령 사진이 접수되었습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "제출" })).not.toBeInTheDocument();
  expect(captureDb.sets).toHaveLength(1);
  expect(captureDb.sets[0].completed).toBe(true);
  expect(captureDb.sets[0].photos.map((p) => p.light)).toEqual(Array(7).fill("ROOM"));
  expect(captureDb.objects.size).toBe(7);
});

test("직접 입력을 고르면 이유를 적어야 제출할 수 있다", async () => {
  const user = await shootRequired();
  await user.selectOptions(screen.getByLabelText("화면(흰색)을 찍지 않은 이유"), "직접 입력");
  expect(submitButton()).toBeDisabled();
  await user.type(screen.getByLabelText("이유"), "화면 줄무늬");
  expect(submitButton()).toBeEnabled();
});

test("사진 하나의 업로드가 실패하면 다시 시도 때 실패한 사진만 올리고 완료한다", async () => {
  let puts = 0;
  let failed = false;
  server.use(
    http.put(`${MOCK_STORAGE_ORIGIN}/*`, () => {
      puts++;
      if (failed) return undefined;
      failed = true;
      return HttpResponse.error();
    }),
  );
  const user = await shootRequired();
  await user.click(submitButton());
  expect(await screen.findByText(/1장을 올리지 못했습니다/)).toBeInTheDocument();
  const before = puts;
  await user.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText(/수령 사진이 접수되었습니다/)).toBeInTheDocument();
  expect(puts - before).toBe(1);
  expect(captureDb.sets).toHaveLength(1);
});

test("사전 서명 URL이 만료되면 같은 세트에서 URL만 다시 받아 남은 사진을 올리고 완료한다", async () => {
  let expiredOnce = false;
  server.use(
    http.put(`${MOCK_STORAGE_ORIGIN}/*`, () => {
      if (expiredOnce) return undefined;
      expiredOnce = true;
      return new HttpResponse(null, { status: 403 });
    }),
  );
  const user = await shootRequired();
  await user.click(submitButton());
  expect(await screen.findByText(/수령 사진이 접수되었습니다/)).toBeInTheDocument();
  expect(captureDb.reissued).toBe(1);
  expect(captureDb.sets).toHaveLength(1);
});

test("URL 다시 받기가 안 되면 새 세트를 만들어 올린다", async () => {
  let expiredOnce = false;
  server.use(
    http.put(`${MOCK_STORAGE_ORIGIN}/*`, () => {
      if (expiredOnce) return undefined;
      expiredOnce = true;
      return new HttpResponse(null, { status: 403 });
    }),
    http.post("*/api/v1/captures/sets/:setId/uploads", () => HttpResponse.json({ status: 404, code: "NOT_FOUND" }, { status: 404 })),
  );
  const user = await shootRequired();
  await user.click(submitButton());
  expect(await screen.findByText(/수령 사진이 접수되었습니다/)).toBeInTheDocument();
  expect(captureDb.sets).toHaveLength(2);
});

test("서버가 빠진 면이 있다고 거절하면 그 면 이름이 보이고 그 면을 다시 찍게 한다", async () => {
  server.use(
    http.post("*/api/v1/captures/sets/:setId/complete", () =>
      HttpResponse.json({ title: "빠진 면", status: 409, code: "CAPTURE_FACES_MISSING", missingFaces: ["SL"] }, { status: 409 }),
    ),
  );
  const user = await shootRequired();
  await user.click(submitButton());
  expect(await screen.findByText("다음 면을 다시 찍어 주세요: 왼쪽 옆면")).toBeInTheDocument();
  expect(screen.getByText("남은 필수 면: 왼쪽 옆면")).toBeInTheDocument();
  expect(submitButton()).toBeDisabled();
});

test("촬영 권한이 만료된 뒤 제출하면 새 QR을 받으라는 문장이 보인다", async () => {
  const user = await shootRequired();
  captureDb.grants.clear();
  await user.click(submitButton());
  expect(await screen.findByText("촬영 시간이 지났습니다. 대여 담당자에게 새 QR을 받아 주세요.")).toBeInTheDocument();
});

test("찍은 사진이 있으면 페이지를 떠날 때 브라우저가 묻고, 저장소에는 토큰이 남지 않는다", async () => {
  await shootRequired();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

test("제출을 두 번 눌러도 세트는 하나만 만들고, 제출 중에는 면 버튼과 이유 칸이 잠긴다", async () => {
  const user = await shootRequired();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  server.use(
    http.post("*/api/v1/captures/sets", async () => {
      await gate;
      return undefined;
    }),
  );
  await user.dblClick(submitButton());
  expect(screen.getByRole("button", { name: /^윗면/ })).toBeDisabled();
  expect(screen.getByLabelText("화면(흰색)을 찍지 않은 이유")).toBeDisabled();
  release();
  expect(await screen.findByText(/수령 사진이 접수되었습니다/)).toBeInTheDocument();
  expect(captureDb.sets).toHaveLength(1);
});

test("찍은 사진이 있으면 앱 안에서 다른 화면으로 갈 때도 묻고, 취소하면 사진이 남는다", async () => {
  await shootRequired();
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  await act(() => app.router.navigate("/my/rentals"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByText("필수 면을 모두 찍었습니다.")).toBeInTheDocument();
  await act(() => app.router.navigate("/my/rentals"));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(app.router.state.location.pathname).toBe("/my/rentals");
  confirm.mockRestore();
});

test("렌탈 기종 치수를 읽었으면 세트에 기종·치수(device)를 싣고, 못 읽었으면 빼고 보낸다", async () => {
  const rental = db.rentals.find((r) => db.report.owners.has(r.rentalId));
  const modelCode = rental && db.report.timelines.get(rental.rentalId)?.modelCode;
  const model = db.models.find((m) => m.modelCode === modelCode);
  if (!rental || !model) throw new Error("고객 렌탈 목 데이터가 없습니다");
  let user = await shootRequired(rental.rentalId);
  await user.click(submitButton());
  await screen.findByText(/수령 사진이 접수되었습니다/);
  expect(captureDb.sets.at(-1)?.device).toEqual({ modelCode: model.modelCode, dimensions: model.dimensions });
  app.unmount();

  // 내 렌탈이 아니라 리포트(기종)를 못 읽으면 device 없이 보낸다(서버 기본 기종)
  user = await shootRequired();
  await user.click(submitButton());
  await screen.findByText(/수령 사진이 접수되었습니다/);
  expect(captureDb.sets.at(-1)?.device).toBeUndefined();
});

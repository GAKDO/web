import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nanoid } from "nanoid";
import { http, HttpResponse } from "msw";
import { server } from "../../shared/mocks/node";
import { renderAsAdmin } from "../../test/renderApp";
import type { Checkpoint } from "../../shared/api/types";
import { captureDb } from "../../shared/mocks/captureDb";
import { db } from "../../shared/mocks/db";
import { agentCommands } from "./components/PairingCodePanel";

const now = new Date().toISOString();

async function openRental(out: Checkpoint["status"]) {
  const device = db.devices.find((d) => d.serial === "C02AIR0002");
  const rentalId = nanoid();
  const checkpoints: Checkpoint[] = [{ checkpointId: nanoid(), type: "OUT", status: out, occurredAt: now }];
  db.rentals.push({ rentalId, deviceId: device?.deviceId ?? "", renterRef: "R-3101", status: "OPEN", startedAt: now, endedAt: null, createdAt: now, checkpoints });
  const { client } = renderAsAdmin(`/admin/rentals/${rentalId}`);
  return { step: await screen.findByRole("listitem", { name: "출고" }), rentalId, checkpointId: checkpoints[0].checkpointId, client };
}

test("봉인 전 시점에서 진단 페어링 코드를 만들면 6자리 코드와 남은 시간이 보인다", async () => {
  const { step, rentalId, checkpointId } = await openRental("OPEN");
  await userEvent.setup().click((await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" })));
  expect(await within(step).findByLabelText("페어링 코드")).toHaveTextContent(/^\d{6}$/);
  expect(within(step).getByText(/남은 시간 \d분 \d+초/)).toBeInTheDocument();
  expect(captureDb.pairings).toMatchObject([{ rentalId, checkpointId, deviceSerial: "C02AIR0002" }]);
});

test("진단이 아직 없어 5초마다 다시 읽어도 발급한 코드는 사라지지 않고 같은 자리에 그대로 있다", async () => {
  const { step, client } = await openRental("OPEN");
  await userEvent.setup().click(await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" }));
  const code = await within(step).findByLabelText("페어링 코드");
  const issued = code.textContent;
  const notice = within(step).getByText(/아직 올라온 진단이 없습니다/);
  // 진단 폴링(5초)과 같은 다시 읽기를 두 번 돌린 뒤에도 코드·안내 문장이 다시 그려지지(새 노드) 않아야 한다(11/8 깜빡임·코드 사라짐)
  // 다시 읽는 도중(응답 전) 화면을 본다: 예전에는 이때 status가 pending으로 돌아가 칸이 통째로 사라졌다
  server.use(
    http.get("*/api/v1/diagnostics/checkpoints/:checkpointId", async () => {
      await new Promise((r) => setTimeout(r, 300));
      return HttpResponse.json({ type: "about:blank", title: "진단이 없습니다", status: 404, code: "NOT_FOUND" }, { status: 404 });
    }),
  );
  let refetching: Promise<void> = Promise.resolve();
  await act(async () => {
    refetching = client.refetchQueries({ queryKey: ["report", "diagnostics"] });
    await new Promise((r) => setTimeout(r, 50));
  });
  expect(within(step).queryByLabelText("페어링 코드")).toBe(code);
  expect(within(step).queryByText(/아직 올라온 진단이 없습니다/)).toBe(notice);
  await act(() => refetching);
  expect(within(step).getByLabelText("페어링 코드")).toBe(code);
  expect(code).toHaveTextContent(issued ?? "");
  expect(within(step).getByText(/아직 올라온 진단이 없습니다/)).toBe(notice);
});

test("5분이 지나면 코드를 가리고 새로 만들라고 알린다", async () => {
  const { step } = await openRental("OPEN");
  await userEvent.setup().click((await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" })));
  await within(step).findByLabelText("페어링 코드");
  const later = Date.now() + 5 * 60_000 + 1000;
  const spy = vi.spyOn(Date, "now").mockReturnValue(later);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1100));
  });
  expect(within(step).queryByLabelText("페어링 코드")).not.toBeInTheDocument();
  expect(within(step).getByRole("status")).toHaveTextContent("만료됐습니다");
  expect(within(step).getByRole("button", { name: "페어링 코드 다시 만들기" })).toBeInTheDocument();
  spy.mockRestore();
});

test("봉인된 시점에는 페어링 코드 버튼이 없다", async () => {
  const { step } = await openRental("SEALED");
  expect(within(step).queryByRole("button", { name: "진단 페어링 코드 만들기" })).not.toBeInTheDocument();
});

test("다시 만들기가 실패해도 아직 유효한 코드는 그대로 보인다", async () => {
  const { step } = await openRental("OPEN");
  const user = userEvent.setup();
  await user.click(await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" }));
  const first = (await within(step).findByLabelText("페어링 코드")).textContent;
  server.use(http.post("*/api/v1/auth/pairing-codes", () => HttpResponse.error()));
  await user.click(within(step).getByRole("button", { name: "페어링 코드 다시 만들기" }));
  expect(await within(step).findByRole("alert")).toBeInTheDocument();
  expect(within(step).getByLabelText("페어링 코드")).toHaveTextContent(first ?? "");
});

test("목록에서 들어와도 요청에 그 렌탈 기기의 시리얼이 실리고, 시리얼 없는 요청은 400이다", async () => {
  const { step } = await openRental("OPEN");
  await userEvent.setup().click((await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" })));
  await within(step).findByLabelText("페어링 코드");
  expect(captureDb.pairings.at(-1)?.deviceSerial).toBe("C02AIR0002");
  const admin = db.accounts.find((a) => a.role === "ADMIN");
  if (!admin) throw new Error("관리자 목 계정이 없습니다");
  db.accessTokens.set("admin-no-serial", admin);
  const res = await fetch("http://localhost/api/v1/auth/pairing-codes", {
    method: "POST",
    headers: { Authorization: "Bearer admin-no-serial", "Content-Type": "application/json" },
    body: JSON.stringify({ rentalId: nanoid(), checkpointId: nanoid() }),
  });
  expect(res.status).toBe(400);
});

test("상세에 시리얼이 없으면(옛 서버) 코드를 만들 수 없고 이유가 보인다", async () => {
  server.use(
    http.get("*/api/v1/rentals/:rentalId", ({ params }) => {
      const rental = db.rentals.find((r) => r.rentalId === params.rentalId);
      return HttpResponse.json(rental);
    }),
  );
  const { step } = await openRental("OPEN");
  expect((await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" }))).toBeDisabled();
  expect(within(step).getByRole("note")).toHaveTextContent("기기 시리얼");
});

test("주소로 바로 연 렌탈도 렌탈 목록을 읽지 않고 상세의 시리얼로 코드를 만든다", async () => {
  let listCalls = 0;
  server.use(
    http.get("*/api/v1/rentals", () => {
      listCalls += 1;
      return HttpResponse.json({ items: [], nextCursor: null });
    }),
  );
  const { step, rentalId } = await openRental("OPEN");
  await userEvent.setup().click((await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" })));
  await within(step).findByLabelText("페어링 코드");
  expect(captureDb.pairings.at(-1)).toMatchObject({ rentalId, deviceSerial: "C02AIR0002" });
  expect(listCalls).toBe(0);
});

test("페어링 코드를 만들면 맥·윈도우 설치 명령을 지금 주소와 코드로 복사하고 안내 한 줄이 보인다", async () => {
  const { step } = await openRental("OPEN");
  const u = userEvent.setup();
  await u.click(await within(step).findByRole("button", { name: "진단 페어링 코드 만들기" }));
  const code = (await within(step).findByLabelText("페어링 코드")).textContent ?? "";
  const write = vi.spyOn(navigator.clipboard, "writeText");
  await u.click(within(step).getByRole("button", { name: "맥 명령 복사" }));
  expect(write).toHaveBeenLastCalledWith(agentCommands(window.location.origin, code).mac);
  await u.click(within(step).getByRole("button", { name: "윈도우 PowerShell 명령 복사" }));
  expect(write).toHaveBeenLastCalledWith(agentCommands(window.location.origin, code).windows);
  expect(within(step).getByText("노트북 터미널(윈도우는 PowerShell)에 붙여 넣으세요. 관리자 PowerShell이면 SSD 수명까지 읽어요(아니어도 진행돼요). 결과를 보여 준 뒤 y를 눌러야 올라가요.")).toBeInTheDocument();
});

test("gakdo.site에서는 B가 정한 명령 그대로, 다른 주소에서는 그 서버로 올리게 TRACE_API_URL을 같이 넣는다", () => {
  expect(agentCommands("https://gakdo.site", "123456")).toEqual({
    mac: "curl -fsSL https://gakdo.site/agent.sh | sh -s 123456",
    windows: "& ([scriptblock]::Create((irm https://gakdo.site/agent.ps1))) 123456",
  });
  expect(agentCommands("http://localhost:5173", "123456")).toEqual({
    mac: "curl -fsSL http://localhost:5173/agent.sh | TRACE_API_URL=http://localhost:5173 sh -s 123456",
    windows:
      "try { $env:TRACE_API_URL='http://localhost:5173'; & ([scriptblock]::Create((irm http://localhost:5173/agent.ps1))) 123456 } finally { Remove-Item Env:TRACE_API_URL -ErrorAction SilentlyContinue }",
  });
  // API를 다른 서버로 둔 빌드(VITE_API_BASE)면 스크립트는 화면에서, 진단은 API 서버로
  expect(agentCommands("https://gakdo.site", "123456", "http://10.0.0.5:8080").mac).toBe(
    "curl -fsSL https://gakdo.site/agent.sh | TRACE_API_URL=http://10.0.0.5:8080 sh -s 123456",
  );
});

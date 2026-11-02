import { http, HttpResponse } from "msw";
import { nanoid } from "nanoid";
import type { CheckpointType, Rental, RentalCreateRequest, RentalPage } from "../../api/types";
import { accountFromRequest, advanceCheckpoint, db } from "../db";
import { problem } from "./problem";

// 렌탈·시점 목. 규칙은 계약 C1 rental-server.yaml을 따른다
const ORDER: CheckpointType[] = ["OUT", "RCV", "RET"];

/** 고객이 읽을 수 있는 GET(목록·상세)은 자기 렌탈만 보인다(FR-USR-03) */
function ownedBy(request: Request): string | null {
  const account = accountFromRequest(request);
  return account?.role === "CUSTOMER" ? account.accountId : null;
}

function denied(request: Request) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "관리자만 쓸 수 있습니다");
  return null;
}

/** 브라우저 목에서만: 2초마다 촬영 → 등급 → 봉인. 주소에 ?mock=slow-seal이 있으면 등급에서 멈춘다.
 * 수령(RCV)은 고객이 폰으로 찍어 제출해야 촬영됨이 되므로 여기서 올리지 않는다(capture 목의 완료가 올림) */
export function simulateCapture(rentalId: string, type: CheckpointType, from: "start" | "captured" = "start") {
  if (import.meta.env.MODE === "test") return;
  if (type === "RCV" && from === "start") return;
  const until = window.location.search.includes("mock=slow-seal") ? "GRADED" : "SEALED";
  [1, 2, 3].forEach((n) => setTimeout(() => advanceCheckpoint(rentalId, type, until), n * 2000));
}

export const rentalHandlers = [
  http.get("*/api/v1/rentals", ({ request }) => {
    const owner = ownedBy(request);
    const no = owner ? null : denied(request);
    if (no) return no;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const matched = [...db.rentals]
      .reverse()
      .filter((r) => !status || r.status === status)
      .filter((r) => !owner || db.report.owners.get(r.rentalId) === owner);
    const items = matched.slice(start, start + limit).map((r) => {
      const device = db.devices.find((d) => d.deviceId === r.deviceId);
      return { rentalId: r.rentalId, deviceId: r.deviceId, serial: device?.serial ?? "", modelCode: device?.modelCode ?? "", status: r.status, createdAt: r.createdAt };
    });
    const body: RentalPage = { items, nextCursor: start + limit < matched.length ? String(start + limit) : null };
    return HttpResponse.json(body);
  }),

  http.post("*/api/v1/rentals", async ({ request }) => {
    const no = denied(request);
    if (no) return no;
    const body = (await request.json()) as RentalCreateRequest;
    const device = db.devices.find((d) => d.deviceId === body.deviceId);
    if (!device) return problem(404, "NOT_FOUND", "기기가 없습니다");
    if (device.status !== "ACTIVE") return problem(409, "DEVICE_NOT_ACTIVE", "사용 가능한 기기가 아닙니다");
    if (db.rentals.some((r) => r.deviceId === device.deviceId && r.status === "OPEN")) {
      return problem(409, "RENTAL_OPEN_EXISTS", "진행 중인 렌탈이 있습니다");
    }
    const now = new Date().toISOString();
    const rental: Rental = { rentalId: nanoid(), deviceId: device.deviceId, renterRef: body.renterRef, status: "OPEN", startedAt: null, endedAt: null, createdAt: now, checkpoints: [] };
    db.rentals.push(rental);
    return HttpResponse.json(rental, { status: 201 });
  }),

  http.get("*/api/v1/rentals/:rentalId", ({ request, params }) => {
    const owner = ownedBy(request);
    const no = owner ? null : denied(request);
    if (no) return no;
    const rental = db.rentals.find((r) => r.rentalId === params.rentalId);
    if (rental && owner && db.report.owners.get(rental.rentalId) !== owner) return problem(403, "OUT_OF_SCOPE", "이 렌탈을 볼 권한이 없습니다");
    return rental ? HttpResponse.json(rental) : problem(404, "NOT_FOUND", "렌탈이 없습니다");
  }),

  http.post("*/api/v1/rentals/:rentalId/checkpoints", async ({ request, params }) => {
    const no = denied(request);
    if (no) return no;
    const rental = db.rentals.find((r) => r.rentalId === params.rentalId);
    if (!rental) return problem(404, "NOT_FOUND", "렌탈이 없습니다");
    const { type } = (await request.json()) as { type: CheckpointType };
    const last = rental.checkpoints.at(-1);
    // 앞 시점이 봉인된 뒤에만 다음 시점(계약 409 예시 문장, c1-questions 11)
    if (rental.status === "CLOSED" || ORDER[rental.checkpoints.length] !== type || (last && last.status !== "SEALED")) {
      return problem(409, "CHECKPOINT_ORDER_VIOLATION", "시점 순서가 맞지 않습니다");
    }
    const checkpoint = { checkpointId: nanoid(), type, status: "OPEN" as const, occurredAt: null };
    rental.checkpoints.push(checkpoint);
    if (type === "OUT") rental.startedAt = new Date().toISOString();
    if (type === "RET") rental.status = "RETURNED";
    simulateCapture(rental.rentalId, type);
    return HttpResponse.json(checkpoint, { status: 201 });
  }),

  http.post("*/api/v1/rentals/:rentalId/close", ({ request, params }) => {
    const no = denied(request);
    if (no) return no;
    const rental = db.rentals.find((r) => r.rentalId === params.rentalId);
    if (!rental) return problem(404, "NOT_FOUND", "렌탈이 없습니다");
    const ret = rental.checkpoints.find((c) => c.type === "RET");
    if (ret?.status !== "SEALED") return problem(409, "RENTAL_NOT_CLOSABLE", "아직 종료할 수 없습니다");
    rental.status = "CLOSED";
    rental.endedAt = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
];

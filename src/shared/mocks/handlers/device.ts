import { http, HttpResponse } from "msw";
import type { DeviceCreateRequest, DeviceModelUpsertRequest, DevicePage, DeviceUpdateRequest } from "../../api/types";
import { accountFromRequest, db, mockDevice } from "../db";
import { problem } from "./problem";

// 기기·기종 목. 규칙은 계약 C1 rental-server.yaml을 따른다
function denied(request: Request) {
  const account = accountFromRequest(request);
  if (!account) return problem(401, "UNAUTHENTICATED", "로그인이 필요합니다");
  if (account.role !== "ADMIN") return problem(403, "FORBIDDEN", "관리자만 쓸 수 있습니다");
  return null;
}

const hasOpenRental = (deviceId: string) => db.rentals.some((r) => r.deviceId === deviceId && r.status !== "CLOSED");

export const deviceHandlers = [
  http.get("*/api/v1/devices", ({ request }) => {
    const no = denied(request);
    if (no) return no;
    const url = new URL(request.url);
    const modelCode = url.searchParams.get("modelCode");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const matched = db.devices.filter(
      (d) =>
        (!modelCode || d.modelCode === modelCode) &&
        (!status || d.status === status) &&
        (!q || d.serial.toLowerCase().includes(q) || (d.assetNo ?? "").toLowerCase().includes(q)),
    );
    const items = matched.slice(start, start + limit);
    const body: DevicePage = { items, nextCursor: start + limit < matched.length ? String(start + limit) : null, totalCount: matched.length };
    return HttpResponse.json(body);
  }),

  http.post("*/api/v1/devices", async ({ request }) => {
    const no = denied(request);
    if (no) return no;
    const body = (await request.json()) as DeviceCreateRequest;
    const found = db.models.find((m) => m.modelCode === body.modelCode);
    if (!found) return problem(404, "NOT_FOUND", "기종이 없습니다");
    if (db.devices.some((d) => d.serial === body.serial)) return problem(409, "DEVICE_SERIAL_EXISTS", "이미 있는 시리얼");
    const device = { ...mockDevice(body.serial, found, "ACTIVE", body.assetNo ?? null), os: body.os, color: body.color ?? null };
    db.devices.push(device);
    return HttpResponse.json(device, { status: 201 });
  }),

  // 기기 상세(contracts #28): 기기별 렌탈 이력 화면 머리글
  http.get("*/api/v1/devices/:deviceId", ({ request, params }) => {
    const no = denied(request);
    if (no) return no;
    const device = db.devices.find((d) => d.deviceId === params.deviceId);
    if (!device) return problem(404, "NOT_FOUND", "기기가 없습니다");
    return HttpResponse.json(device);
  }),

  http.patch("*/api/v1/devices/:deviceId", async ({ request, params }) => {
    const no = denied(request);
    if (no) return no;
    const device = db.devices.find((d) => d.deviceId === params.deviceId);
    if (!device) return problem(404, "NOT_FOUND", "기기가 없습니다");
    const body = (await request.json()) as DeviceUpdateRequest;
    // 폐기 기기는 수리 중으로만 되돌린다(codes.yaml 0.6.0)
    if (device.status === "RETIRED" && body.status === "ACTIVE") {
      return problem(409, "DEVICE_STATUS_TRANSITION_INVALID", "폐기 기기는 수리 중을 거쳐야 합니다");
    }
    if (body.status && body.status !== "ACTIVE" && hasOpenRental(device.deviceId)) {
      return problem(409, "DEVICE_HAS_OPEN_RENTAL", "진행 중인 렌탈이 있습니다");
    }
    Object.assign(device, body, { updatedAt: new Date().toISOString() });
    if (body.status) device.retiredAt = body.status === "RETIRED" ? device.updatedAt : null;
    return HttpResponse.json(device);
  }),

  http.get("*/api/v1/device-models", ({ request }) => {
    const no = denied(request);
    if (no) return no;
    const items = db.models.map(({ modelCode, name, manufacturer, formFactor, spec }) => ({ modelCode, name, manufacturer, formFactor, spec }));
    return HttpResponse.json({ items });
  }),

  // 기종 등록·수정: 없으면 만들고 있으면 바꾼다. 이름을 바꾸면 기기의 modelName도 따라간다
  http.put("*/api/v1/device-models/:modelCode", async ({ request, params }) => {
    const no = denied(request);
    if (no) return no;
    const modelCode = String(params.modelCode);
    if (!/^[A-Z0-9][A-Z0-9-]{1,63}$/.test(modelCode)) return problem(400, "VALIDATION_FAILED", "기종 코드 형식이 아닙니다");
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") return problem(400, "VALIDATION_FAILED", "본문이 객체가 아닙니다");
    const body = raw as DeviceModelUpsertRequest;
    const d = body.dimensions;
    const nameOk = typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 128;
    const manufacturerOk = body.manufacturer === undefined || (typeof body.manufacturer === "string" && body.manufacturer.length <= 64);
    const dimsOk = !!d && [d.widthMm, d.depthMm, d.baseHMm, d.lidHMm].every((n) => typeof n === "number" && n > 0);
    const specOk =
      !body.spec ||
      ([body.spec.ramGb, body.spec.ssdGb].every((n) => n === undefined || (Number.isInteger(n) && n >= 1)) &&
        (body.spec.gpu === undefined || (typeof body.spec.gpu === "string" && body.spec.gpu.length <= 128)));
    if (!nameOk || !manufacturerOk || body.formFactor !== "CLAMSHELL" || !dimsOk || !specOk) {
      return problem(400, "VALIDATION_FAILED", "입력값 오류", "이름·형태·치수(0 초과)·사양을 확인해 주세요.");
    }
    const saved = {
      modelCode,
      name: body.name,
      manufacturer: body.manufacturer ?? null,
      formFactor: body.formFactor,
      spec: body.spec ?? null,
      dimensions: d,
      updatedAt: new Date().toISOString(),
    };
    const index = db.models.findIndex((m) => m.modelCode === modelCode);
    if (index >= 0) db.models[index] = saved;
    else db.models.push(saved);
    for (const device of db.devices) if (device.modelCode === modelCode) device.modelName = saved.name;
    return HttpResponse.json(saved);
  }),
];

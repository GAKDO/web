import { nanoid } from "nanoid";
import type { Device, DeviceModel, DeviceStatus, Rental, TokenRole } from "../api/types";

// MSW 목 서버의 메모리 데이터. ID는 계약대로 NanoID 21자(헌법 1.1.0). 테스트마다 resetDb()로 처음 상태로 돌린다.
// 계정·비밀번호는 계약 예시 값이고 실제 비밀이 아니다.
export const MOCK_ADMIN = { email: "admin@example.com", password: "example-pass-1234" } as const;
export const MOCK_CUSTOMER = { email: "renter@example.com", password: "example-pass-1234" } as const;

interface Account {
  accountId: string;
  email: string;
  password: string;
  role: TokenRole;
}

interface MockState {
  accounts: Account[];
  /** 살아 있는 액세스 토큰 → 계정 */
  accessTokens: Map<string, Account>;
  /** 리프레시 쿠키 대신: 브라우저 쿠키는 테스트(Node)에서 유지되지 않아 계정 하나를 기억한다 */
  refreshAccount: Account | null;
  models: DeviceModel[];
  devices: Device[];
  rentals: Rental[];
}

const NOW = "2026-11-01T09:00:00Z";
const dims = { widthMm: 304, depthMm: 215, baseHMm: 11, lidHMm: 6 };

function model(modelCode: string, name: string, manufacturer: string): DeviceModel {
  return { modelCode, name, manufacturer, formFactor: "CLAMSHELL", spec: null, dimensions: dims, updatedAt: NOW };
}

export function mockDevice(serial: string, m: DeviceModel, status: DeviceStatus, assetNo: string | null = null): Device {
  return {
    deviceId: nanoid(),
    serial,
    modelCode: m.modelCode,
    modelName: m.name,
    os: m.manufacturer === "Apple" ? "MACOS" : "WINDOWS",
    color: null,
    assetNo,
    status,
    retiredAt: status === "RETIRED" ? NOW : null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function initialState(): MockState {
  const [air, pro, gram] = [
    model("MBA13-M2", "MacBook Air (M2, 2022)", "Apple"),
    model("MBP14-M3", "MacBook Pro 14 (M3, 2023)", "Apple"),
    model("LG-GRAM16", "LG gram 16 (2024)", "LG"),
  ];
  const devices = [
    mockDevice("C02AIR0001", air, "ACTIVE", "TR-0001"),
    mockDevice("C02AIR0002", air, "ACTIVE", "TR-0002"),
    mockDevice("C02AIR0003", air, "MAINTENANCE", "TR-0003"),
    mockDevice("C02PRO0001", pro, "ACTIVE", "TR-0101"),
    mockDevice("C02PRO0002", pro, "RETIRED", "TR-0102"),
    mockDevice("LGGRAM0001", gram, "ACTIVE", "TR-0201"),
    mockDevice("LGGRAM0002", gram, "MAINTENANCE", null),
    mockDevice("LGGRAM0003", gram, "ACTIVE", "TR-0203"),
  ];
  // 첫 기기에는 진행 중인 렌탈이 있다(상태 바꾸기 409 확인용)
  const rentals: Rental[] = [
    { rentalId: nanoid(), deviceId: devices[0].deviceId, renterRef: "R-1001", status: "OPEN", startedAt: NOW, endedAt: null, createdAt: NOW, checkpoints: [] },
  ];
  return {
    models: [air, pro, gram],
    devices,
    rentals,
    accounts: [
      { accountId: nanoid(), ...MOCK_ADMIN, role: "ADMIN" },
      { accountId: nanoid(), ...MOCK_CUSTOMER, role: "CUSTOMER" },
    ],
    accessTokens: new Map(),
    refreshAccount: null,
  };
}

export let db: MockState = initialState();

export function resetDb(): void {
  db = initialState();
}

export function issueAccessToken(account: Account): string {
  const token = `mock.${nanoid()}`;
  db.accessTokens.set(token, account);
  return token;
}

/** 테스트용: 지금 액세스 토큰을 모두 만료시킨다 */
export function expireAccessTokens(): void {
  db.accessTokens.clear();
}

export function accountFromRequest(request: Request): Account | null {
  const header = request.headers.get("Authorization") ?? "";
  return db.accessTokens.get(header.replace(/^Bearer /, "")) ?? null;
}

import { nanoid } from "nanoid";
import { customerFixtures, type ReportState } from "./report";
import type { CheckpointStatus, CheckpointType, Device, DeviceModel, DeviceStatus, Rental, TokenRole } from "../api/types";

// MSW 목 서버의 메모리 데이터. ID는 계약대로 NanoID 21자(헌법 1.1.0). 테스트마다 resetDb()로 처음 상태로 돌린다.
// 계정·비밀번호는 계약 예시 값이고 실제 비밀이 아니다.
export const MOCK_ADMIN = { email: "admin@example.com", password: "example-pass-1234" } as const;
export const MOCK_CUSTOMER = { email: "renter@example.com", password: "example-pass-1234" } as const;
/** 목 서버가 보내는 재설정 코드(계약 예시 값) */
export const MOCK_RESET_CODE = "654321";
/** 목 서버가 가입 메일로 "보내는" 인증 코드(계약 예시 값) */
export const MOCK_EMAIL_CODE = "123456";

interface Account {
  accountId: string;
  email: string;
  password: string;
  role: TokenRole;
  /** 가입 뒤 메일 인증 전이면 true(로그인 403 EMAIL_NOT_VERIFIED) */
  pending?: boolean;
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
  /** 비밀번호 재설정 코드: 이메일 → 코드·남은 시도(0이면 폐기) */
  resetCodes: Map<string, { code: string; remaining: number }>;
  /** WE3 리포트 목(렌탈 주인·타임라인·검사·사진·진단) */
  report: ReportState;
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
  const accounts: Account[] = [
    { accountId: nanoid(), ...MOCK_ADMIN, role: "ADMIN" },
    { accountId: nanoid(), ...MOCK_CUSTOMER, role: "CUSTOMER" },
  ];
  // 고객 계정의 렌탈 2개(WE3 리포트)
  const customer = customerFixtures(accounts[1].accountId, [devices[3], devices[5]]);
  return {
    models: [air, pro, gram],
    devices,
    rentals: [...rentals, ...customer.rentals],
    report: customer.report,
    accounts,
    accessTokens: new Map(),
    refreshAccount: null,
    resetCodes: new Map(),
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

const NEXT_STATUS: Record<CheckpointStatus, CheckpointStatus> = { OPEN: "CAPTURED", CAPTURED: "GRADED", GRADED: "SEALED", SEALED: "SEALED" };

/** 촬영·검사·봉인을 흉내 낸다: 한 시점을 한 단계 올린다. 테스트는 직접 부르고, 브라우저 목은 시간이 지나면 부른다 */
export function advanceCheckpoint(rentalId: string, type: CheckpointType, until: CheckpointStatus = "SEALED"): void {
  const checkpoint = db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.find((c) => c.type === type);
  if (!checkpoint || checkpoint.status === until) return;
  checkpoint.status = NEXT_STATUS[checkpoint.status];
  if (checkpoint.status === "CAPTURED") checkpoint.occurredAt = new Date().toISOString();
}

/** 테스트용: 마지막 시점을 봉인까지 올린다 */
export function sealLastCheckpoint(rentalId: string): void {
  const last = db.rentals.find((r) => r.rentalId === rentalId)?.checkpoints.at(-1);
  for (let i = 0; i < 3 && last; i += 1) advanceCheckpoint(rentalId, last.type);
}

// 화면이 쓰는 API 타입은 모두 여기서 꺼낸다. 원본은 contracts C1(contracts/VERSION)에서 만든 generated/ 이고,
// 계약이 바뀌면 scripts/sync-contracts.sh → npm run gen:api 뒤 이 파일만 맞춘다(FR-034).
import type { components as AuthComponents, paths as AuthPaths } from "./generated/auth";
import type { components as RentalComponents, paths as RentalPaths } from "./generated/rental";

type AuthSchemas = AuthComponents["schemas"];
type RentalSchemas = RentalComponents["schemas"];

export type ApiPaths = AuthPaths & RentalPaths;

export type LoginRequest = AuthSchemas["LoginRequest"];
export type TokenResponse = AuthSchemas["TokenResponse"];
export type TokenRole = AuthSchemas["AuthTokenRole"];
export type Problem = AuthSchemas["Problem"];
export type ErrorCode = AuthSchemas["ErrorCode"];
export type PublicId = AuthSchemas["PublicId"];

export type Device = RentalSchemas["Device"];
export type DevicePage = RentalSchemas["DevicePage"];
export type DeviceCreateRequest = RentalSchemas["DeviceCreateRequest"];
export type DeviceUpdateRequest = RentalSchemas["DeviceUpdateRequest"];
export type DeviceModel = RentalSchemas["DeviceModel"];
export type DeviceModelSummary = RentalSchemas["DeviceModelSummary"];
export type Rental = RentalSchemas["Rental"];
export type RentalSummary = RentalSchemas["RentalSummary"];
export type RentalCreateRequest = RentalSchemas["RentalCreateRequest"];
export type RentalPage = RentalSchemas["RentalPage"];
export type Checkpoint = RentalSchemas["Checkpoint"];

export type DeviceStatus = RentalSchemas["DeviceStatus"];
export type DeviceOs = RentalSchemas["DeviceOs"];
export type RentalStatus = RentalSchemas["RentalStatus"];
export type CheckpointType = RentalSchemas["RentalCheckpointType"];
export type CheckpointStatus = RentalSchemas["RentalCheckpointStatus"];

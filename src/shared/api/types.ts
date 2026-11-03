// 화면이 쓰는 API 타입은 모두 여기서 꺼낸다. 원본은 contracts C1(contracts/VERSION)에서 만든 generated/ 이고,
// 계약이 바뀌면 scripts/sync-contracts.sh → npm run gen:api 뒤 이 파일만 맞춘다(FR-034).
import type { components as AuthComponents, paths as AuthPaths } from "./generated/auth";
import type { components as RentalComponents, paths as RentalPaths } from "./generated/rental";
import type { components as ReportComponents, paths as ReportPaths } from "./generated/report";
import type { components as CaptureComponents, paths as CapturePaths } from "./generated/capture";
import type { components as DiagnosticsComponents, paths as DiagnosticsPaths } from "./generated/diagnostics";

type AuthSchemas = AuthComponents["schemas"];
type RentalSchemas = RentalComponents["schemas"];
type ReportSchemas = ReportComponents["schemas"];

// 로그인 JWT로 부르는 경로. capture-server의 리포트용 GET(검사·사진)도 로그인 JWT로 부른다(WE3)
export type ApiPaths = AuthPaths & RentalPaths & ReportPaths & CapturePaths & DiagnosticsPaths;

export type LoginRequest = AuthSchemas["LoginRequest"];
export type PairingCodeResponse = AuthSchemas["PairingCodeResponse"];
export type SignupRequest = AuthSchemas["SignupRequest"];
export type EmailVerifyRequest = AuthSchemas["EmailVerifyRequest"];
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
export type DeviceModelUpsertRequest = RentalSchemas["DeviceModelUpsertRequest"];
export type DeviceFormFactor = RentalSchemas["DeviceFormFactor"];
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

export type VerifyResponse = ReportSchemas["VerifyResponse"];
export type VerifyRecord = ReportSchemas["VerifyRecord"];
export type InspectionGrade = ReportSchemas["InspectionGrade"];

// WE2 폰 수령 촬영: capture-server와 auth-server 수령 QR(contracts fd35e33)

type CaptureSchemas = CaptureComponents["schemas"];

export type CaptureApiPaths = CapturePaths;
export type CaptureLinkResponse = AuthSchemas["CaptureLinkResponse"];
export type CaptureTokenResponse = AuthSchemas["CaptureTokenResponse"];
export type PhotoSpec = CaptureSchemas["PhotoSpec"];
export type CaptureSetCreateRequest = CaptureSchemas["CaptureSetCreateRequest"];
export type CaptureSetCreateResponse = CaptureSchemas["CaptureSetCreateResponse"];
export type CaptureDevice = CaptureSchemas["CaptureDevice"];
export type CaptureSetCompleteRequest = CaptureSchemas["CaptureSetCompleteRequest"];
export type UploadTarget = CaptureSchemas["UploadTarget"];
export type UploadReissueRequest = CaptureSchemas["UploadReissueRequest"];
export type CaptureSet = CaptureSchemas["CaptureSet"];
export type CaptureFace = CaptureSchemas["CaptureFace"];
export type CaptureLight = CaptureSchemas["CaptureLight"];
export type CaptureCamera = CaptureSchemas["CaptureCamera"];

export type MeResponse = AuthSchemas["MeResponse"];

// WE3 리포트: report-server 타임라인·진행률, capture-server 검사 결과·사진, diagnostics-server(contracts fd35e33)

type DiagnosticsSchemas = DiagnosticsComponents["schemas"];

export type RentalTimeline = ReportSchemas["RentalTimeline"];
export type TimelineCheckpoint = ReportSchemas["TimelineCheckpoint"];
export type Pin = ReportSchemas["Pin"];
export type ProgressEvent = ReportSchemas["ProgressEvent"];
export type DoneEvent = ReportSchemas["DoneEvent"];
export type ChainStatus = ReportSchemas["ReportChainStatus"];
export type ProgressStage = ReportSchemas["ReportProgressStage"];
export type Grade = ReportSchemas["InspectionGrade"];
export type Inspection = CaptureSchemas["Inspection"];
export type Defect = CaptureSchemas["Defect"];
export type DefectClass = CaptureSchemas["InspectionDefectClass"];
export type DefectSource = CaptureSchemas["InspectionDefectSource"];
export type CheckpointMedia = CaptureSchemas["CheckpointMedia"];
export type CheckpointDiagnostics = DiagnosticsSchemas["CheckpointDiagnostics"];
export type RunSummary = DiagnosticsSchemas["RunSummary"];
export type DiagnosticsFlag = DiagnosticsSchemas["InspectionFlag"];
export type DiagnosticsFlagKind = DiagnosticsSchemas["DiagnosticsFlagKind"];
export type DiagnosticsSkippedReason = DiagnosticsSchemas["DiagnosticsSkippedReason"];

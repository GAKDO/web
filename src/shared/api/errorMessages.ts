import type { DeviceStatus, ErrorCode } from "./types";
import { DEVICE_STATUS_LABEL } from "../codes/labels";
import type { ApiError } from "./problem";

const RETRY = "잠시 뒤 다시 시도해 주세요.";
const RELOGIN = "로그인 시간이 지났습니다. 다시 로그인해 주세요.";

// codes.yaml error_code마다 화면 문장 하나. code가 늘면 Record 타입이 빠진 문장을 알려 준다(FR-030).
// WE1에서 보이는 문장은 specs/001-admin-rental-screens/contracts/ui-api-usage.md와 같게 둔다.
const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "입력값을 확인해 주세요.",
  UNAUTHENTICATED: RELOGIN,
  FORBIDDEN: "관리자만 쓸 수 있는 화면입니다.",
  OUT_OF_SCOPE: "이 항목을 볼 권한이 없습니다.",
  NOT_FOUND: "찾는 항목이 없습니다. 목록에서 다시 골라 주세요.",
  RATE_LIMITED: "요청이 너무 잦습니다. 1분 뒤 다시 시도해 주세요.",
  IDEMPOTENCY_KEY_CONFLICT: "같은 요청이 이미 처리됐습니다. 화면을 새로 고쳐 주세요.",
  INTERNAL_ERROR: RETRY,
  CONSENT_REQUIRED: "개인정보 수집에 동의해 주세요.",
  EMAIL_ALREADY_EXISTS: "이미 가입된 이메일입니다.",
  CODE_INVALID: "인증 코드가 맞지 않습니다.",
  CODE_EXPIRED: "인증 코드가 만료됐습니다. 다시 받아 주세요.",
  RESEND_TOO_SOON: "1분 뒤에 다시 보낼 수 있습니다.",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요.",
  EMAIL_NOT_VERIFIED: "이메일 인증이 끝나지 않은 계정입니다.",
  REFRESH_INVALID: RELOGIN,
  CAPTURE_LINK_INVALID: "만료됐거나 이미 쓴 링크입니다.",
  RENTAL_LINKED_TO_OTHER: "다른 계정에 연결된 렌탈입니다.",
  CLIENT_CREDENTIALS_INVALID: "부스 인증 정보가 맞지 않습니다.",
  PAIRING_CODE_INVALID: "페어링 코드가 맞지 않습니다.",
  PAIRING_CODE_EXPIRED: "페어링 코드가 만료됐습니다.",
  RENTAL_OPEN_EXISTS: "이 기기로 진행 중인 렌탈이 이미 있습니다. 그 렌탈을 먼저 종료하세요.",
  DEVICE_NOT_ACTIVE: "이 기기는 렌탈할 수 없는 상태입니다. 사용 가능한 기기를 고르세요.",
  CHECKPOINT_ORDER_VIOLATION: "시점은 출고 → 수령 → 반납 순서로만 시작할 수 있습니다. 최신 상태를 다시 불러왔습니다.",
  RENTAL_NOT_CLOSABLE: "반납 기록이 봉인되기 전에는 종료할 수 없습니다.",
  RECORD_ALREADY_SEALED: "이미 봉인된 기록입니다.",
  DEVICE_SERIAL_EXISTS: "이미 등록된 시리얼입니다. 시리얼을 다시 확인해 주세요.",
  DEVICE_HAS_OPEN_RENTAL: "진행 중인 렌탈이 있어 상태를 바꿀 수 없습니다. 렌탈을 먼저 종료하세요.",
  DEVICE_STATUS_TRANSITION_INVALID: "폐기한 기기는 바로 사용 가능으로 바꿀 수 없습니다. 먼저 수리 중으로 되돌리세요.",
  PILOT_ALIAS_EXISTS: "이미 있는 파일럿 별칭입니다.",
  NOT_TEST_DATA: "시험 데이터(시리얼 TEST-)만 지울 수 있습니다.",
  BOOTH_CODE_INVALID: "부스 코드가 맞지 않습니다.",
  BOOTH_CODE_EXPIRED: "부스 코드가 만료됐거나 이미 쓰였습니다. 새로 발급하세요.",
  CAPTURE_FACES_MISSING: "빠진 면이 있습니다.",
  CAPTURE_HASH_MISMATCH: "사진이 올바르게 올라가지 않았습니다. 다시 올려 주세요.",
  CAPTURE_SET_CLOSED: "이미 끝난 촬영입니다.",
  DIAGNOSTIC_ALREADY_UPLOADED: "이미 올린 진단입니다.",
  DIAGNOSTIC_SCHEMA_INVALID: "진단 결과 형식이 맞지 않습니다.",
  DEVICE_SERIAL_MISMATCH: "진단한 기기의 시리얼이 렌탈 기기와 다릅니다.",
};

export interface MessageContext {
  /** DEVICE_NOT_ACTIVE 문장에 넣을, 화면이 아는 기기 상태 */
  deviceStatus?: DeviceStatus;
}

/** 오류를 사람이 읽는 문장으로. 모르는 code면 detail, 그것도 없으면 일반 문장 */
export function messageFor(error: ApiError, context: MessageContext = {}): string {
  if (error.status === 0) return `서버에 연결하지 못했습니다. ${RETRY}`;
  if (error.code === "DEVICE_NOT_ACTIVE" && context.deviceStatus && context.deviceStatus !== "ACTIVE") {
    return `이 기기는 ${DEVICE_STATUS_LABEL[context.deviceStatus]} 상태라 렌탈을 만들 수 없습니다. 사용 가능한 기기를 고르세요.`;
  }
  if (error.code) {
    const base = MESSAGES[error.code];
    return error.code === "VALIDATION_FAILED" && error.detail ? `${base} ${error.detail}` : base;
  }
  if (error.status >= 500) return RETRY;
  return error.detail ?? `요청을 처리하지 못했습니다. ${RETRY}`;
}

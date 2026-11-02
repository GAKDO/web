// 코드 값(contracts codes.yaml)의 한국어 이름표. 값 자체는 생성 타입에서만 온다(FR-015).
import type { CaptureFace, CheckpointStatus, CheckpointType, DeviceOs, DeviceStatus, RentalStatus } from "../api/types";

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  ACTIVE: "사용 가능",
  MAINTENANCE: "수리 중",
  RETIRED: "폐기",
};

export const DEVICE_OS_LABEL: Record<DeviceOs, string> = { MACOS: "macOS", WINDOWS: "Windows" };

export const RENTAL_STATUS_LABEL: Record<RentalStatus, string> = {
  OPEN: "진행 중",
  RETURNED: "반납됨",
  CLOSED: "종료",
};

export const CHECKPOINT_TYPE_LABEL: Record<CheckpointType, string> = { OUT: "출고", RCV: "수령", RET: "반납" };

export const CHECKPOINT_STATUS_LABEL: Record<CheckpointStatus, string> = {
  OPEN: "촬영 대기",
  CAPTURED: "촬영됨",
  GRADED: "등급 매김",
  SEALED: "봉인",
};

export const CAPTURE_FACE_LABEL: Record<CaptureFace, string> = {
  TOP: "윗면(덮개)",
  BOT: "바닥",
  SF: "앞 옆면",
  SB: "뒤 옆면",
  SL: "왼쪽 옆면",
  SR: "오른쪽 옆면",
  KB: "키보드",
  SCR0: "화면(꺼짐)",
  SCR1: "화면(흰색)",
};

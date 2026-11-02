// 코드 값(contracts codes.yaml)의 한국어 이름표. 값 자체는 생성 타입에서만 온다(FR-015).
import type { ChainStatus, CheckpointStatus, CheckpointType, DeviceOs, DeviceStatus, InspectionGrade, RentalStatus } from "../api/types";

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

export const INSPECTION_GRADE_LABEL: Record<InspectionGrade, string> = { A: "A등급", B: "B등급", C: "C등급", D: "D등급" };

// WE3 리포트
export const CHAIN_STATUS_LABEL: Record<ChainStatus, string> = {
  VALID: "기록 정상",
  BROKEN: "기록이 바뀌었을 수 있습니다",
  PENDING: "기록 확인 중",
};

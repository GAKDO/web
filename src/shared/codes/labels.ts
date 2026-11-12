// 코드 값(contracts codes.yaml)의 한국어 이름표. 값 자체는 생성 타입에서만 온다(FR-015).
import type {
  CaptureCamera,
  CaptureFace,
  CaptureLight,
  ChainStatus,
  CheckpointStatus,
  CheckpointType,
  DefectClass,
  DefectSource,
  DismissReason,
  DeviceFormFactor,
  DeviceOs,
  ReviewStatus,
  DeviceStatus,
  DiagnosticsFlagKind,
  DiagnosticsSkippedReason,
  InspectionGrade,
  ProgressStage,
  RentalStatus,
} from "../api/types";

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  ACTIVE: "사용 가능",
  MAINTENANCE: "수리 중",
  RETIRED: "폐기",
};

export const DEVICE_FORM_FACTOR_LABEL: Record<DeviceFormFactor, string> = { CLAMSHELL: "클램셸(접는 노트북)" };

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

/** 부스 조명(codes.yaml capture.light): L1 확산, L2 왼쪽·L3 뒤·L4 앞 스침광, 폰은 실내등 */
export const CAPTURE_LIGHT_LABEL: Record<CaptureLight, string> = {
  L1: "L1 확산",
  L2: "L2 왼쪽 스침광",
  L3: "L3 뒤쪽 스침광",
  L4: "L4 앞쪽 스침광",
  ROOM: "실내등",
  OFF: "조명 끔",
};

/** 카메라(codes.yaml capture.camera): 부스 위 두 대가 각자 면 전체를 찍는다(11/9 보정, docs/pin-calibration.md) */
export const CAPTURE_CAMERA_LABEL: Record<CaptureCamera, string> = { CAM1: "CAM1", CAM2: "CAM2", PHONE: "폰" };

export const INSPECTION_GRADE_LABEL: Record<InspectionGrade, string> = { A: "A등급", B: "B등급", C: "C등급", D: "D등급" };

// WE3 리포트
export const DEFECT_CLASS_LABEL: Record<DefectClass, string> = { scratch: "긁힘", dent: "찍힘", crack: "균열", stain: "오염" };

// 관리자 검사 결과(spec 006)
export const DEFECT_SOURCE_LABEL: Record<DefectSource, string> = { AUTO: "자동 탐지", HUMAN: "사람이 표시" };

// 사람 검수(11/8): AI가 넓게 잡은 후보를 관리자가 확정·기각
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = { PENDING: "검수 전", CONFIRMED: "흠집 맞음", DISMISSED: "흠집 아님" };
export const DISMISS_REASON_LABEL: Record<DismissReason, string> = {
  DUST: "먼지·얼룩",
  TAPE: "스티커·테이프",
  REFLECTION: "빛 반사",
  PART: "원래 있는 부품·무늬",
  OTHER: "기타",
};

export const FLAG_LABEL: Record<DiagnosticsFlagKind, string> = {
  COMPONENT_CHANGED: "부품 구성이 바뀌었습니다",
  CAPACITY_DROP: "배터리 용량이 크게 줄었습니다",
  BENCH_DROP: "성능 측정값이 크게 떨어졌습니다",
  ACTIVATION_LOCK_ON: "활성화 잠금(나의 Mac 찾기)이 켜져 있습니다",
  DISK_ENCRYPTION_ON: "디스크 암호화(FileVault·BitLocker)가 켜져 있습니다",
  DISK_HEALTH_WARNING: "운영체제가 SSD 상태를 경고했습니다",
  SECURITY_PROTECTION_OFF: "백신·시스템 보호(Defender·Gatekeeper·SIP)가 꺼져 있습니다",
  THREAT_DETECTED: "새 악성코드 탐지 기록이 있습니다",
};

export const PROGRESS_STAGE_LABEL: Record<ProgressStage, string> = {
  UPLOADED: "사진 올림",
  ALIGNED: "면 맞춤",
  INSPECTED: "흠집 검사",
  GRADED: "등급 매김",
  SEALED: "봉인",
};

export const CHAIN_STATUS_LABEL: Record<ChainStatus, string> = {
  VALID: "기록 정상",
  BROKEN: "기록이 바뀌었을 수 있습니다",
  PENDING: "기록 확인 중",
};

export const SKIPPED_REASON_LABEL: Record<DiagnosticsSkippedReason, string> = {
  NO_PERMISSION: "권한 없음",
  UNSUPPORTED: "지원하지 않는 기기",
  TOOL_ERROR: "읽는 도구 오류",
  NO_AC_POWER: "전원 어댑터 없음",
};

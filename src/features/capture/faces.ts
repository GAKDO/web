import type { CaptureCamera, CaptureFace, CaptureLight } from "../../shared/api/types";

// 폰 수령 촬영의 면 목록. 필수 면은 codes.yaml capture.face_required.PHONE과 같아야 한다(faces.test.ts가 대조).
export const PHONE_REQUIRED_FACES: readonly CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "SCR0"];
/** 폰은 모든 면을 실내 조명으로 찍는다. SCR1도 ROOM(WE2 명세 가정) */
export const PHONE_LIGHT: CaptureLight = "ROOM";
export const PHONE_CAMERA: CaptureCamera = "PHONE";

export interface FaceGuide {
  face: CaptureFace;
  required: boolean;
  /** 카메라 화면 위에 보일 한 줄 설명 */
  guide: string;
  /** 윤곽선 가로 ÷ 세로(면별 고정 그림, 기종 치수 반영은 뒤로 미룸) */
  aspect: number;
}

const LID = 1.41;
const FRONT_BACK = 8;
const LEFT_RIGHT = 6;

export const PHONE_FACES: readonly FaceGuide[] = [
  { face: "TOP", required: true, guide: "노트북을 닫고 바로 위에서 덮개 전체가 윤곽선 안에 들어오게 찍으세요", aspect: LID },
  { face: "BOT", required: true, guide: "노트북을 뒤집어 바닥 전체가 윤곽선 안에 들어오게 찍으세요", aspect: LID },
  { face: "SF", required: true, guide: "노트북을 닫고 앞쪽(여는 쪽) 옆면을 정면에서 찍으세요", aspect: FRONT_BACK },
  { face: "SB", required: true, guide: "노트북을 닫고 뒤쪽(경첩 쪽) 옆면을 정면에서 찍으세요", aspect: FRONT_BACK },
  { face: "SL", required: true, guide: "노트북을 닫고 왼쪽 옆면을 정면에서 찍으세요", aspect: LEFT_RIGHT },
  { face: "SR", required: true, guide: "노트북을 닫고 오른쪽 옆면을 정면에서 찍으세요", aspect: LEFT_RIGHT },
  { face: "SCR0", required: true, guide: "노트북을 열고 화면을 끈 채 화면 전체를 정면에서 찍으세요", aspect: 1.5 },
  { face: "SCR1", required: false, guide: "화면을 켜고 흰 화면을 띄운 채 정면에서 찍으세요(선택)", aspect: 1.5 },
];

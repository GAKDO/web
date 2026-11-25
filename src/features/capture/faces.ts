import type { CaptureCamera, CaptureFace, CaptureLight } from "../../shared/api/types";

// 폰 수령 촬영의 면 목록. 필수 면은 codes.yaml capture.face_required.PHONE과 같아야 한다(faces.test.ts가 대조).
export const PHONE_REQUIRED_FACES: readonly CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "SCR0"];
/** 폰은 모든 면을 실내 조명으로 찍는다. SCR1도 ROOM(WE2 명세 가정) */
export const PHONE_LIGHT: CaptureLight = "ROOM";
export const PHONE_CAMERA: CaptureCamera = "PHONE";

/** 기종 치수(mm). contracts rental ModelDimensions와 같은 모양 */
export interface FaceDimensions {
  widthMm: number;
  depthMm: number;
  baseHMm: number;
  lidHMm: number;
}

/** 촬영 권한으로는 기종 치수를 읽을 API가 없어, 계약 예시 기종(13인치급) 치수로 윤곽 비율을 정한다 */
export const DEFAULT_DIMENSIONS: FaceDimensions = { widthMm: 304.1, depthMm: 215, baseHMm: 7, lidHMm: 4.3 };

export interface FaceGuide {
  face: CaptureFace;
  required: boolean;
  /** 카메라 화면 위에 보일 한 줄 설명 */
  guide: string;
  /** 윤곽선 가로 ÷ 세로. contracts capture/faces.md의 "크기(가로 × 세로)"를 따른다 */
  aspect: number;
  /** 윤곽선 위쪽·왼쪽에 붙일 방향 표시. faces.md의 "이미지 위쪽"·"이미지 왼쪽" */
  top: string;
  left: string;
}

type Size = (d: FaceDimensions) => [number, number];
const PLAN: Size = (d) => [d.widthMm, d.depthMm];
const FRONT_BACK: Size = (d) => [d.widthMm, d.baseHMm + d.lidHMm];
const LEFT_RIGHT: Size = (d) => [d.depthMm, d.baseHMm + d.lidHMm];

// contracts capture/faces.md "면별 방향" 표. 폰 윤곽은 표의 "이미지 위쪽"이 화면 위로 오게 그린다
// guide는 처음 쓰는 사람도 바로 따라 하도록 "노트북을 어떻게 두고, 어디서, 무엇이 사진 위로 오게" 순서로 쓴다(11/12)
const TABLE: readonly { face: CaptureFace; size: Size; top: string; left: string; guide: string }[] = [
  {
    face: "TOP",
    size: PLAN,
    top: "경첩",
    left: "내 왼쪽",
    guide: "노트북을 닫아 책상에 놓고, 바로 위에서 덮개를 찍으세요. 화면이 접히는 쪽(경첩)이 사진 위로 오게 하세요.",
  },
  {
    face: "BOT",
    size: PLAN,
    top: "경첩",
    left: "내 오른쪽",
    guide: "노트북을 닫은 채 앞 모서리를 들어 뒤로 넘겨 뒤집으세요(옆으로 굴리지 마세요). 바로 위에서 바닥을 찍고, 경첩이 사진 위로 오게 하세요.",
  },
  {
    face: "SF",
    size: FRONT_BACK,
    top: "덮개",
    left: "내 왼쪽",
    guide: "노트북을 닫아 책상에 놓고, 여는 쪽 옆면을 정면 눈높이에서 찍으세요. 덮개가 사진 위로 오게 하세요.",
  },
  {
    face: "SB",
    size: FRONT_BACK,
    top: "덮개",
    left: "내 오른쪽",
    guide: "노트북을 닫아 책상에 놓고, 경첩 쪽 옆면을 정면 눈높이에서 찍으세요. 덮개가 사진 위로 오게 하세요.",
  },
  {
    face: "SL",
    size: LEFT_RIGHT,
    top: "덮개",
    left: "경첩",
    guide: "노트북을 닫아 책상에 놓고, 왼쪽 옆면(키보드를 앞에 뒀을 때 왼쪽)을 정면 눈높이에서 찍으세요. 덮개가 위, 경첩이 왼쪽에 오게 하세요.",
  },
  {
    face: "SR",
    size: LEFT_RIGHT,
    top: "덮개",
    left: "여는 쪽",
    guide: "노트북을 닫아 책상에 놓고, 오른쪽 옆면(키보드를 앞에 뒀을 때 오른쪽)을 정면 눈높이에서 찍으세요. 덮개가 위, 여는 쪽이 왼쪽에 오게 하세요.",
  },
  {
    face: "SCR0",
    size: PLAN,
    top: "화면 위 모서리",
    left: "내 왼쪽",
    guide: "노트북을 열고 화면을 끈 채, 화면 정면에서 화면 전체가 들어오게 찍으세요.",
  },
  {
    face: "SCR1",
    size: PLAN,
    top: "화면 위 모서리",
    left: "내 왼쪽",
    guide: "화면을 켜고 흰 화면(빈 메모장 등)을 꽉 채워 띄운 뒤, 정면에서 찍으세요. 선택이라 건너뛰어도 돼요.",
  },
];

/** 기종 치수로 면별 윤곽 안내를 만든다 */
export function faceGuides(dims: FaceDimensions = DEFAULT_DIMENSIONS): FaceGuide[] {
  return TABLE.map(({ face, size, top, left, guide }) => {
    const [w, h] = size(dims);
    return { face, required: PHONE_REQUIRED_FACES.includes(face), guide, aspect: w / h, top, left };
  });
}

export const PHONE_FACES: readonly FaceGuide[] = faceGuides();

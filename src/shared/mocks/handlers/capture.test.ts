// 이 파일이 확인하는 것: 화면 시험에 쓰는 가짜 촬영 서버(목)가 진짜 서버 계약과 같은 사진 수 상한(세트당 80장)을 지키는지.

import type { CaptureCamera, CaptureFace, CaptureLight, PhotoSpec } from "../../api/types";
import { captureDb } from "../captureDb";
import { MAX_SET_PHOTOS } from "./capture";

const rentalId = "r".repeat(21);
const checkpointId = "c".repeat(21);
const token = "grant-photo-limit";

const FACES: CaptureFace[] = ["TOP", "BOT", "SF", "SB", "SL", "SR", "KB", "SCR0", "SCR1"];
const LIGHTS: CaptureLight[] = ["L1", "L2", "L3", "L4", "ROOM", "OFF"];
const CAMERAS: CaptureCamera[] = ["CAM1", "CAM2", "PHONE"];

/** 계약 PhotoSpec 모양으로, (face, light, camera)가 겹치지 않는 사진 n장(최대 9 × 6 × 3 = 162) */
// 테스트 도구: (면, 조명, 카메라)가 겹치지 않는 사진 n장 목록을 계약 모양으로 만든다.
function photos(n: number): PhotoSpec[] {
  const combos = FACES.flatMap((face) => LIGHTS.flatMap((light) => CAMERAS.map((camera) => ({ face, light, camera }))));
  const takenAt = new Date().toISOString();
  return combos.slice(0, n).map((c, i) => ({ ...c, contentType: "image/jpeg", sha256: i.toString(16).padStart(64, "0"), takenAt }));
}

// 테스트 도구: 고객 촬영 토큰으로 폰 세트 만들기 요청을 보낸다.
async function createSet(n: number): Promise<Response> {
  return fetch("http://localhost/api/v1/captures/sets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rentalId, checkpointId, source: "PHONE", photos: photos(n) }),
  });
}

// 테스트 도구: 시험마다 1분짜리 고객 촬영 권한을 가짜 서버에 넣어 둔다.
beforeEach(() => {
  captureDb.grants.set(token, { rentalId, checkpointId, accountId: "a".repeat(21), expiresAt: Date.now() + 60_000 });
});

// [상황] 사진 상한 값과 시험용 사진 81장의 조합을 확인한다.
// [기대] 상한은 계약과 같은 80장이고, 시험 사진 81장의 (면, 조명, 카메라)는 모두 다르다(시험 자체가 중복으로 실패하지 않게).
test("세트 사진 상한은 계약과 같은 80장이고, 픽스처의 (face, light, camera)는 겹치지 않는다", () => {
  expect(MAX_SET_PHOTOS).toBe(80);
  const keys = photos(MAX_SET_PHOTOS + 1).map((p) => `${p.face}/${p.light}/${p.camera}`);
  expect(new Set(keys).size).toBe(MAX_SET_PHOTOS + 1);
});

// [상황] 80장, 81장으로 세트를 만든다.
// [기대] 80장은 201로 만들어지고, 81장은 400 VALIDATION_FAILED다.
//        ※ 응답 코드: 201 = 새로 만들어짐, 400 = 요청 내용이 형식에 맞지 않음
test("80장까지는 세트를 만들고, 81장이면 400 VALIDATION_FAILED를 돌려준다", async () => {
  expect((await createSet(MAX_SET_PHOTOS)).status).toBe(201);
  const over = await createSet(MAX_SET_PHOTOS + 1);
  expect(over.status).toBe(400);
  expect(((await over.json()) as { code: string }).code).toBe("VALIDATION_FAILED");
});

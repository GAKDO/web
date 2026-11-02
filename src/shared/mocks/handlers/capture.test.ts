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
function photos(n: number): PhotoSpec[] {
  const combos = FACES.flatMap((face) => LIGHTS.flatMap((light) => CAMERAS.map((camera) => ({ face, light, camera }))));
  const takenAt = new Date().toISOString();
  return combos.slice(0, n).map((c, i) => ({ ...c, contentType: "image/jpeg", sha256: i.toString(16).padStart(64, "0"), takenAt }));
}

async function createSet(n: number): Promise<Response> {
  return fetch("http://localhost/api/v1/captures/sets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rentalId, checkpointId, source: "PHONE", photos: photos(n) }),
  });
}

beforeEach(() => {
  captureDb.grants.set(token, { rentalId, checkpointId, accountId: "a".repeat(21), expiresAt: Date.now() + 60_000 });
});

test("세트 사진 상한은 계약과 같은 80장이고, 픽스처의 (face, light, camera)는 겹치지 않는다", () => {
  expect(MAX_SET_PHOTOS).toBe(80);
  const keys = photos(MAX_SET_PHOTOS + 1).map((p) => `${p.face}/${p.light}/${p.camera}`);
  expect(new Set(keys).size).toBe(MAX_SET_PHOTOS + 1);
});

test("80장까지는 세트를 만들고, 81장이면 400 VALIDATION_FAILED를 돌려준다", async () => {
  expect((await createSet(MAX_SET_PHOTOS)).status).toBe(201);
  const over = await createSet(MAX_SET_PHOTOS + 1);
  expect(over.status).toBe(400);
  expect(((await over.json()) as { code: string }).code).toBe("VALIDATION_FAILED");
});

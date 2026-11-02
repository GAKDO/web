import { captureDb } from "../captureDb";
import { MAX_SET_PHOTOS } from "./capture";

const rentalId = "r".repeat(21);
const checkpointId = "c".repeat(21);
const token = "grant-photo-limit";

function photos(n: number) {
  return Array.from({ length: n }, (_, i) => ({ face: "TOP", light: "ROOM", camera: "PHONE", contentType: "image/jpeg", sha256: i.toString(16).padStart(64, "0"), bytes: 1 }));
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

test("세트 사진 상한은 계약과 같은 80장이다", () => {
  expect(MAX_SET_PHOTOS).toBe(80);
});

test("80장까지는 세트를 만들고, 81장이면 400 VALIDATION_FAILED를 돌려준다", async () => {
  expect((await createSet(MAX_SET_PHOTOS)).status).toBe(201);
  const over = await createSet(MAX_SET_PHOTOS + 1);
  expect(over.status).toBe(400);
  expect(((await over.json()) as { code: string }).code).toBe("VALIDATION_FAILED");
});

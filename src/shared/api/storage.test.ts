import { captureApi, unwrap } from "./client";
import { putToStorage } from "./storage";
import { captureTokenStore } from "../auth/captureTokenStore";
import { captureDb, grantFromRequest, mockCaptureLink, sha256Hex } from "../mocks/captureDb";
import type { UploadTarget } from "./types";

async function grantFor(link = mockCaptureLink()) {
  captureDb.grants.set("cap.test", { rentalId: link.rentalId, checkpointId: link.checkpointId, accountId: "acc", expiresAt: Date.now() + 1800_000 });
  captureTokenStore.set({ accessToken: "cap.test", tokenType: "Bearer", expiresIn: 1800, rentalId: link.rentalId, checkpointId: link.checkpointId });
  return link;
}

async function createSet(bytes: Uint8Array) {
  const link = await grantFor();
  const sha256 = await sha256Hex(bytes.buffer as ArrayBuffer);
  const created = await unwrap(
    captureApi.POST("/api/v1/captures/sets", {
      body: {
        rentalId: link.rentalId,
        checkpointId: link.checkpointId,
        source: "PHONE",
        photos: [{ face: "TOP", light: "ROOM", camera: "PHONE", sha256, contentType: "image/jpeg", takenAt: new Date().toISOString() }],
      },
    }),
  );
  return { created, sha256 };
}

test("촬영 권한으로 세트를 만들고, 받은 헤더를 그대로 실은 PUT은 저장소에 같은 해시로 남는다", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const { created, sha256 } = await createSet(bytes);
  expect(created.uploads).toHaveLength(1);
  expect(await putToStorage(created.uploads[0], bytes.buffer as ArrayBuffer)).toBe("ok");
  expect([...captureDb.objects.values()]).toEqual([sha256]);
});

test("서명 헤더가 빠진 PUT은 저장소가 거절한다", async () => {
  const { created } = await createSet(new Uint8Array([9]));
  const target: UploadTarget = { ...created.uploads[0], headers: { "Content-Type": "image/jpeg" } };
  expect(await putToStorage(target, new Uint8Array([9]).buffer)).toBe("expired");
  expect(captureDb.objects.size).toBe(0);
});

test("업로드 URL이 만료됐으면 보내지 않고 만료로 알린다", async () => {
  const { created } = await createSet(new Uint8Array([7]));
  const target: UploadTarget = { ...created.uploads[0], expiresAt: new Date(Date.now() - 1000).toISOString() };
  expect(await putToStorage(target, new Uint8Array([7]).buffer)).toBe("expired");
});

test("다른 시점의 세트를 만들려 하면 403 OUT_OF_SCOPE", async () => {
  await grantFor();
  const call = captureApi.POST("/api/v1/captures/sets", {
    body: { rentalId: "x".repeat(21), checkpointId: "y".repeat(21), source: "PHONE", photos: [] },
  });
  await expect(unwrap(call)).rejects.toMatchObject({ status: 403, code: "OUT_OF_SCOPE" });
  expect(grantFromRequest(new Request("http://x", { headers: { Authorization: "Bearer cap.test" } }))).not.toBeNull();
});

test("만료된 촬영 권한으로 세트를 만들면 401", async () => {
  const link = await grantFor();
  const grant = captureDb.grants.get("cap.test");
  if (grant) grant.expiresAt = Date.now() - 1;
  const call = captureApi.POST("/api/v1/captures/sets", {
    body: { rentalId: link.rentalId, checkpointId: link.checkpointId, source: "PHONE", photos: [] },
  });
  await expect(unwrap(call)).rejects.toMatchObject({ status: 401 });
});

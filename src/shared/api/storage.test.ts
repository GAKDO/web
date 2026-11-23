// 이 파일이 확인하는 것: 폰 촬영 사진을 저장소(MinIO)에 올리는 과정.
// 서버가 준 업로드 주소와 헤더로만 올릴 수 있고, 미리 알린 해시(사진 지문)와 같은 사진만 저장된다.
// 저장소와 서버는 테스트용 가짜(MSW)이다.

import { captureApi, unwrap } from "./client";
import { putToStorage } from "./storage";
import { captureTokenStore } from "../auth/captureTokenStore";
import { captureDb, grantFromRequest, mockCaptureLink, sha256Hex } from "../mocks/captureDb";
import type { UploadTarget } from "./types";

// 테스트 도구: 한 렌탈·시점에 대한 30분짜리 촬영 권한을 가짜 서버와 브라우저 양쪽에 넣어 둔다.
async function grantFor(link = mockCaptureLink()) {
  captureDb.grants.set("cap.test", { rentalId: link.rentalId, checkpointId: link.checkpointId, accountId: "acc", expiresAt: Date.now() + 1800_000 });
  captureTokenStore.set({ accessToken: "cap.test", tokenType: "Bearer", expiresIn: 1800, rentalId: link.rentalId, checkpointId: link.checkpointId });
  return link;
}

// 테스트 도구: 촬영 권한으로 윗면 사진 한 장짜리 촬영 세트를 만들고, 사진의 해시와 서버 응답(업로드 주소 포함)을 돌려준다.
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

// [상황] 촬영 세트를 만들고, 서버가 준 주소와 헤더를 그대로 실어 사진을 올린다.
// [기대] 저장소에 그 사진이 미리 알린 것과 같은 해시로 남는다.
test("촬영 권한으로 세트를 만들고, 받은 헤더를 그대로 실은 PUT은 저장소에 같은 해시로 남는다", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const { created, sha256 } = await createSet(bytes);
  expect(created.uploads).toHaveLength(1);
  expect(await putToStorage(created.uploads[0], bytes.buffer as ArrayBuffer)).toBe("ok");
  expect([...captureDb.objects.values()]).toEqual([sha256]);
});

// [상황] 서버가 준 헤더 중 서명용 헤더를 빼고 올린다.
// [기대] 저장소가 거절한다(업로드 주소 위조·변조 방지).
test("서명 헤더가 빠진 PUT은 저장소가 거절한다", async () => {
  const { created } = await createSet(new Uint8Array([9]));
  const target: UploadTarget = { ...created.uploads[0], headers: { "Content-Type": "image/jpeg" } };
  expect(await putToStorage(target, new Uint8Array([9]).buffer)).toBe("expired");
  expect(captureDb.objects.size).toBe(0);
});

// [상황] 업로드 주소의 만료 시각이 이미 지났다.
// [기대] 보내지 않고 "만료"로 알린다(다시 받으라는 뜻).
test("업로드 URL이 만료됐으면 보내지 않고 만료로 알린다", async () => {
  const { created } = await createSet(new Uint8Array([7]));
  const target: UploadTarget = { ...created.uploads[0], expiresAt: new Date(Date.now() - 1000).toISOString() };
  expect(await putToStorage(target, new Uint8Array([7]).buffer)).toBe("expired");
});

// [상황] 한 렌탈·시점용 촬영 권한으로 다른 렌탈·시점의 촬영 세트를 만들려 한다.
// [기대] 403 OUT_OF_SCOPE로 거절된다(권한 범위 밖). 촬영 권한 자체는 지워지지 않고 남는다.
test("다른 시점의 세트를 만들려 하면 403 OUT_OF_SCOPE", async () => {
  await grantFor();
  const call = captureApi.POST("/api/v1/captures/sets", {
    body: { rentalId: "x".repeat(21), checkpointId: "y".repeat(21), source: "PHONE", photos: [] },
  });
  await expect(unwrap(call)).rejects.toMatchObject({ status: 403, code: "OUT_OF_SCOPE" });
  expect(grantFromRequest(new Request("http://x", { headers: { Authorization: "Bearer cap.test" } }))).not.toBeNull();
});

// [상황] 만료된 촬영 권한으로 촬영 세트를 만든다.
// [기대] 401로 거절된다.
test("만료된 촬영 권한으로 세트를 만들면 401", async () => {
  const link = await grantFor();
  const grant = captureDb.grants.get("cap.test");
  if (grant) grant.expiresAt = Date.now() - 1;
  const call = captureApi.POST("/api/v1/captures/sets", {
    body: { rentalId: link.rentalId, checkpointId: link.checkpointId, source: "PHONE", photos: [] },
  });
  await expect(unwrap(call)).rejects.toMatchObject({ status: 401 });
});

// [상황] 세트를 만들 때 알린 사진과 다른 내용을 올린다.
// [기대] 저장소가 거절한다(바꿔치기한 사진이 저장되지 않음).
test("알린 해시와 다른 본문을 올리면 저장소가 거절한다", async () => {
  const { created } = await createSet(new Uint8Array([5]));
  expect(await putToStorage(created.uploads[0], new Uint8Array([6]).buffer)).toBe("failed");
  expect(captureDb.objects.size).toBe(0);
});

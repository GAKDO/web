import { captureApi, unwrap } from "../../shared/api/client";
import { putToStorage } from "../../shared/api/storage";
import type { CaptureFace, CaptureSet, UploadTarget } from "../../shared/api/types";
import type { CaptureGrant } from "../../shared/auth/captureTokenStore";
import type { Shot } from "./camera";
import { PHONE_CAMERA, PHONE_LIGHT } from "./faces";

// 제출: 세트 생성 → 사전 서명 PUT(2장씩) → 완료(WE2 FR-017~020, research R4)
export interface Photo {
  face: CaptureFace;
  shot: Shot;
}

export interface UploadSession {
  setId: string;
  uploads: UploadTarget[];
  /** 같은 순서의 사진 해시. 사진이 바뀌면 새 세트를 만든다 */
  hashes: string[];
  done: boolean[];
  /** 재시도에도 같은 키(중복 접수 방지) */
  idempotencyKey: string;
}

export async function createSession(grant: CaptureGrant, photos: Photo[]): Promise<UploadSession> {
  const created = await unwrap(
    captureApi.POST("/api/v1/captures/sets", {
      body: {
        rentalId: grant.rentalId,
        checkpointId: grant.checkpointId,
        source: "PHONE",
        photos: photos.map(({ face, shot }) => ({
          face,
          light: PHONE_LIGHT,
          camera: PHONE_CAMERA,
          sha256: shot.sha256,
          contentType: "image/jpeg" as const,
          takenAt: shot.takenAt,
        })),
      },
    }),
  );
  return {
    setId: created.captureSetId,
    uploads: created.uploads,
    hashes: photos.map((p) => p.shot.sha256),
    done: photos.map(() => false),
    idempotencyKey: crypto.randomUUID(),
  };
}

export const sameShots = (session: UploadSession, photos: Photo[]) =>
  session.hashes.length === photos.length && session.hashes.every((h, i) => h === photos[i].shot.sha256);

/** 아직 안 올린 사진만 2장씩 올린다. 하나라도 만료면 "expired", 실패가 있으면 "failed" */
export async function uploadPending(session: UploadSession, photos: Photo[], onProgress: (done: number) => void): Promise<"ok" | "expired" | "failed"> {
  const queue = session.uploads.map((_, i) => i).filter((i) => !session.done[i]);
  let expired = false;
  let failed = false;
  async function worker() {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      const result = await putToStorage(session.uploads[i], photos[i].shot.bytes);
      if (result === "ok") {
        session.done[i] = true;
        onProgress(session.done.filter(Boolean).length);
      } else if (result === "expired") expired = true;
      else failed = true;
    }
  }
  await Promise.all([worker(), worker()]);
  return expired ? "expired" : failed ? "failed" : "ok";
}

const sameTarget = (a: UploadTarget, b: UploadTarget) => a.face === b.face && a.light === b.light && a.camera === b.camera;

/** 만료된 사전 서명 URL을 같은 세트에서 다시 받는다(아직 안 올린 사진만). 이미 올린 사진은 다시 올리지 않는다 */
export async function reissueUploads(session: UploadSession): Promise<void> {
  const { uploads } = await unwrap(
    captureApi.POST("/api/v1/captures/sets/{setId}/uploads", { params: { path: { setId: session.setId } }, body: {} }),
  );
  // 응답에 없는 사진은 서버에 이미 올라간 것(응답이 끊겨 실패로 남았던 경우 포함)이다
  session.done = session.done.map((done, i) => done || !uploads.some((u) => sameTarget(u, session.uploads[i])));
  session.uploads = session.uploads.map((old) => uploads.find((u) => sameTarget(u, old)) ?? old);
}

export async function completeSession(session: UploadSession, skippedFaces: Partial<Record<CaptureFace, string>>): Promise<CaptureSet> {
  return unwrap(
    captureApi.POST("/api/v1/captures/sets/{setId}/complete", {
      params: { path: { setId: session.setId }, header: { "Idempotency-Key": session.idempotencyKey } },
      body: Object.keys(skippedFaces).length > 0 ? { skippedFaces } : {},
    }),
  );
}

import type { UploadTarget } from "./types";

// 사진 본문은 gateway를 거치지 않고 사전 서명 URL로 저장소(MinIO)에 바로 올린다(FR-CAP-05).
// 서버가 준 headers(Content-Type, x-amz-checksum-sha256)를 그대로 실어야 저장소가 받는다. URL은 로그에 남기지 않는다.
export type PutResult = "ok" | "expired" | "failed";

/** body는 해시를 계산한 바로 그 바이트(JPEG) */
export async function putToStorage(target: UploadTarget, body: ArrayBuffer): Promise<PutResult> {
  if (Date.parse(target.expiresAt) <= Date.now()) return "expired";
  try {
    const response = await fetch(target.url, { method: "PUT", headers: target.headers ?? {}, body });
    if (response.ok) return "ok";
    return response.status === 403 ? "expired" : "failed";
  } catch {
    return "failed";
  }
}

import { nanoid } from "nanoid";
import type { CaptureFace, CaptureLight, PhotoSpec, UploadTarget } from "../api/types";

// WE2 목: 수령 QR 링크·촬영 권한·촬영 세트·저장소 파일. db.ts와 따로 두고 테스트마다 resetCaptureDb()로 비운다.
export const MOCK_STORAGE_ORIGIN = "https://storage.mock";

interface CaptureLink {
  token: string;
  rentalId: string;
  checkpointId: string;
  used: boolean;
  expiresAt: number;
}

interface Grant {
  rentalId: string;
  checkpointId: string;
  accountId: string;
}

export interface MockSet {
  captureSetId: string;
  rentalId: string;
  checkpointId: string;
  photos: PhotoSpec[];
  uploads: UploadTarget[];
  completed: boolean;
  idempotencyKey: string | null;
}

interface CaptureState {
  links: CaptureLink[];
  /** 렌탈 → 연결된 고객 계정 */
  rentalOwner: Map<string, string>;
  grants: Map<string, Grant>;
  sets: MockSet[];
  /** 저장소 객체 경로 → 올라온 본문의 SHA-256(16진수) */
  objects: Map<string, string>;
}

const fresh = (): CaptureState => ({ links: [], rentalOwner: new Map(), grants: new Map(), sets: [], objects: new Map() });

export let captureDb: CaptureState = fresh();

export function resetCaptureDb(): void {
  captureDb = fresh();
}

/** 테스트용: 관리자 화면을 거치지 않고 QR 링크 하나를 만든다 */
export function mockCaptureLink(rentalId = nanoid(), checkpointId = nanoid(), minutes = 60): CaptureLink {
  const link = { token: `qr-${nanoid(32)}`, rentalId, checkpointId, used: false, expiresAt: Date.now() + minutes * 60_000 };
  captureDb.links.push(link);
  return link;
}

export function grantFromRequest(request: Request): Grant | null {
  const header = request.headers.get("Authorization") ?? "";
  return captureDb.grants.get(header.replace(/^Bearer /, "")) ?? null;
}

export function objectPath(setId: string, face: CaptureFace, light: CaptureLight): string {
  return `/trace-captures/${setId}/${face}-${light}.jpg`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBase64(hex: string): string {
  const bytes = hex.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
  return btoa(String.fromCharCode(...bytes));
}

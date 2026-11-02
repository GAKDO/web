import { CHECK_SIZE, toGray, type Gray } from "./quality";

// 카메라·canvas·해시는 이 파일에서만 쓴다. 테스트는 vi.mock("./camera")로 바꿔 끼운다.
/** 올릴 사진의 긴 변(px). 12MP 원본을 줄여 업로드를 빠르게 한다 */
export const UPLOAD_SIZE = 2048;

export interface Shot {
  /** 올릴 JPEG 바이트. 해시도 이 바이트로 계산한다 */
  bytes: ArrayBuffer;
  sha256: string;
  takenAt: string;
  previewUrl: string;
  gray: Gray;
}

export type CameraFailure = "denied" | "none" | "failed";

export class CameraError extends Error {
  constructor(readonly kind: CameraFailure) {
    super(kind);
  }
}

/** 보안 연결(HTTPS·localhost)이고 카메라 API가 있는가 */
export function isCameraContext(): boolean {
  return window.isSecureContext === true && !!navigator.mediaDevices?.getUserMedia;
}

/** 후면 카메라를 우선 연다(없으면 있는 카메라) */
export async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new CameraError("denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new CameraError("none");
    throw new CameraError("failed");
  }
}

/** video에 스트림을 붙이고 재생한다 */
export function attachStream(video: HTMLVideoElement, stream: MediaStream): void {
  video.srcObject = stream;
  void video.play().catch(() => undefined);
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

function draw(source: CanvasImageSource, width: number, height: number, longSide: number): HTMLCanvasElement {
  const scale = Math.min(1, longSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 지금 화면을 JPEG로 찍고, 검사용 회색조와 해시를 함께 만든다 */
export async function captureShot(video: HTMLVideoElement): Promise<Shot> {
  // 첫 프레임 전(videoWidth 0)이면 빈 사진이 되므로 실패로 돌려 다시 찍게 한다
  if (!video.videoWidth || !video.videoHeight) throw new CameraError("failed");
  const photo = draw(video, video.videoWidth, video.videoHeight, UPLOAD_SIZE);
  const blob = await new Promise<Blob | null>((resolve) => photo.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new CameraError("failed");
  const bytes = await blob.arrayBuffer();
  // 검사 이미지는 업로드할 사진과 같은 프레임(photo 캔버스)에서 만든다
  const small = draw(photo, photo.width, photo.height, CHECK_SIZE);
  const pixels = small.getContext("2d")?.getImageData(0, 0, small.width, small.height);
  if (!pixels) throw new CameraError("failed");
  return { bytes, sha256: await sha256Hex(bytes), takenAt: new Date().toISOString(), previewUrl: URL.createObjectURL(blob), gray: toGray(pixels) };
}

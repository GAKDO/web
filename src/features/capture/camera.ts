import { CHECK_SIZE, toGray, type Gray } from "./quality";

// 카메라·canvas·해시는 이 파일에서만 쓴다. 테스트는 vi.mock("./camera")로 바꿔 끼운다.
// 올릴 사진은 줄이지 않고 화면에 보인 4:3 부분만 잘라 낸다(11/2 A 답). 해시는 최종 JPEG 바이트로 계산한다.

/** 4K로 요청한다. 폰이 못 주면 가장 가까운 해상도가 온다 */
const RESOLUTION: MediaTrackConstraints = { width: { ideal: 3840 }, height: { ideal: 2160 } };
/** 후면 카메라를 exact로 먼저 요청한다(ideal이면 해상도가 더 높은 전면이 골라질 수 있음) */
export const CAMERA_CONSTRAINTS: MediaTrackConstraints = { ...RESOLUTION, facingMode: { exact: "environment" } };
/** 후면이 없는 기기(노트북 등)에서 다시 시도할 때 */
export const FALLBACK_CONSTRAINTS: MediaTrackConstraints = { ...RESOLUTION, facingMode: { ideal: "environment" } };

/** 캔버스 한 장의 최대 픽셀(iOS Safari 한도 약 16.7MP). 넘는 사진은 영상 프레임으로 대신 찍는다 */
export const MAX_CANVAS_PIXELS = 16_777_216;

export const JPEG_QUALITY = 0.92;

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
export function isSecure(): boolean {
  return window.isSecureContext === true;
}

/** 브라우저가 카메라 API를 주는지(https와 별개) */
export function hasCameraApi(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}

/** 후면 카메라를 연다. 후면이 없을 때만 있는 카메라로 다시 연다 */
export async function openCamera(): Promise<MediaStream> {
  try {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS, audio: false });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name !== "OverconstrainedError" && name !== "NotFoundError") throw e;
      return await navigator.mediaDevices.getUserMedia({ video: FALLBACK_CONSTRAINTS, audio: false });
    }
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") throw new CameraError("denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new CameraError("none");
    throw new CameraError("failed");
  }
}

/** video에 스트림을 붙이고 재생한다. 영상 크기를 알게 되면(첫 프레임 정보) 끝난다 */
export function attachStream(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  void video.play().catch(() => undefined);
  if (video.videoWidth && video.videoHeight) return Promise.resolve();
  return new Promise((resolve) => video.addEventListener("loadedmetadata", () => resolve(), { once: true }));
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** 뷰파인더 비율(가로 4 : 세로 3). legacy.css `.viewfinder`와 같아야 한다 */
export const VIEWFINDER_ASPECT = 4 / 3;

/** 화면(object-fit: cover)에 보이는 가운데 4:3 부분만 고른다 */
export function viewfinderCrop(width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  if (width / height > VIEWFINDER_ASPECT) {
    const sw = Math.round(height * VIEWFINDER_ASPECT);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / VIEWFINDER_ASPECT);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

type Crop = ReturnType<typeof viewfinderCrop>;

/** 사진과 영상 비율이 이만큼(1%) 안에서 같으면 같은 범위를 찍었다고 본다 */
const SAME_ASPECT = 0.01;

/**
 * 정지 사진(takePhoto)에서 화면에 보인 부분을 고른다. takePhoto는 영상과 같은 범위를 찍는다고 보장하지 않으므로,
 * 사진과 영상의 비율이 같을 때만 같은 범위로 보고 viewfinderCrop을 사진 크기로 늘린다.
 * 비율·방향이 다르면(예: 16:9 영상에 4:3 사진) null을 돌려 영상 프레임으로 찍는다.
 */
export function stillCrop(videoW: number, videoH: number, photoW: number, photoH: number): Crop | null {
  if (Math.abs(photoW / photoH / (videoW / videoH) - 1) > SAME_ASPECT) return null;
  const scale = photoW / videoW;
  const c = viewfinderCrop(videoW, videoH);
  const sw = Math.min(photoW, Math.round(c.sw * scale));
  const sh = Math.min(photoH, Math.round(c.sh * scale));
  return { sx: Math.round((photoW - sw) / 2), sy: Math.round((photoH - sh) / 2), sw, sh };
}

/** 지원하는 폰(Android Chrome 등)은 ImageCapture.takePhoto()로 센서 해상도 사진을 받는다. EXIF 회전을 픽셀에 적용한다 */
async function takeStill(video: HTMLVideoElement): Promise<ImageBitmap | null> {
  const src = video.srcObject;
  const track = src && "getVideoTracks" in src ? src.getVideoTracks()[0] : undefined;
  if (!track || typeof ImageCapture === "undefined" || typeof createImageBitmap === "undefined") return null;
  try {
    const capture = new ImageCapture(track);
    // 디코드 전에 사진 크기를 확인한다. 크기를 모르거나 캔버스 한도를 넘으면 디코드하지 않고 영상 프레임으로 찍는다
    const settings = await capture.getPhotoSettings();
    const { imageWidth: pw = 0, imageHeight: ph = 0 } = settings;
    if (!pw || !ph || pw * ph > MAX_CANVAS_PIXELS) return null;
    const blob = await capture.takePhoto();
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height <= MAX_CANVAS_PIXELS) return bitmap;
    bitmap.close();
  } catch {
    // takePhoto를 못 쓰면 영상 프레임으로 찍는다
  }
  return null;
}

function draw(source: CanvasImageSource, width: number, height: number, longSide: number, crop = { sx: 0, sy: 0, sw: width, sh: height }): HTMLCanvasElement {
  const scale = Math.min(1, longSide / Math.max(crop.sw, crop.sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.sw * scale);
  canvas.height = Math.round(crop.sh * scale);
  canvas.getContext("2d")?.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
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
  // 고객이 윤곽선에 맞춘 화면과 같은 부분만, 줄이지 않고 저장한다
  const still = await takeStill(video);
  // takePhoto를 기다리는 동안 폰을 돌렸을 수 있으므로 영상 크기는 이 시점에 다시 읽는다
  const { videoWidth: w, videoHeight: h } = video;
  const crop = still && stillCrop(w, h, still.width, still.height);
  const photo = still && crop ? draw(still, still.width, still.height, Infinity, crop) : draw(video, w, h, Infinity, viewfinderCrop(w, h));
  still?.close();
  if (!photo.width || !photo.height) throw new CameraError("failed");
  // 캔버스로 다시 쓴 JPEG에는 EXIF가 없다(회전은 이미 픽셀에 적용됨). 해시는 이 최종 바이트로 계산한다
  const blob = await new Promise<Blob | null>((resolve) => photo.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new CameraError("failed");
  const bytes = await blob.arrayBuffer();
  // 검사 이미지는 업로드할 사진과 같은 프레임(photo 캔버스)에서 만든다
  const small = draw(photo, photo.width, photo.height, CHECK_SIZE);
  const pixels = small.getContext("2d")?.getImageData(0, 0, small.width, small.height);
  if (!pixels) throw new CameraError("failed");
  return { bytes, sha256: await sha256Hex(bytes), takenAt: new Date().toISOString(), previewUrl: URL.createObjectURL(blob), gray: toGray(pixels) };
}

/**
 * 브라우저 안에서 라벨 사진의 글자를 읽는다(tesseract.js, 서버·계약 변경 없음).
 * tesseract.js와 언어 데이터는 처음 쓸 때만 내려받도록 동적 import로 늦게 불러온다(첫 화면 번들을 키우지 않음).
 */
export interface OcrProgress {
  /** 0~1 */
  progress: number;
  status: string;
}

// 작업자·wasm·글자 모델은 같은 주소에서 내려받는다(scripts/copy-tesseract.mjs가 빌드 때 public/tesseract/로 복사).
// 외부 CDN을 막는 학교·시연장 망에서도 동작하게 하려는 것
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/tesseract`;

const MAX_SIDE = 2400;
const MIN_SIDE = 1600;

/**
 * 라벨 글씨는 작고 바닥면 각인은 대비가 낮다. 회색조로 바꾸고 밝기 범위를 늘리고, 작으면 키워서 OCR에 넘긴다.
 * 캔버스를 못 쓰는 환경이면 원본을 그대로 쓴다.
 */
async function preprocess(file: Blob): Promise<Blob | HTMLCanvasElement> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_SIDE ? MAX_SIDE / longest : longest < MIN_SIDE ? MIN_SIDE / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
      d[i] = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round(((d[i]! - lo) * 255) / range);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return file;
  }
}

/** 사진 한 장의 글자를 읽어 전체 글자를 돌려준다. 작업자는 쓰고 바로 끝내 메모리를 남기지 않는다 */
export async function readLabelText(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: BASE,
    langPath: `${BASE}/lang`,
    logger: (m) => onProgress?.({ progress: m.progress, status: m.status }),
  });
  try {
    // 라벨은 여러 덩어리로 흩어진 글자라 "흩어진 글자" 모드가 줄 단위 모드보다 잘 읽는다
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const image = await preprocess(file);
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// 라벨 OCR(tesseract.js)이 쓰는 작업자·wasm·영어 글자 모델을 public/tesseract/로 복사한다.
// 외부 CDN(jsdelivr)을 막는 망에서도 같은 주소(gakdo.site)에서 내려받게 하려는 것이다. 복사본은 git에 올리지 않는다(.gitignore).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "tesseract");

// LSTM 전용 코어만 쓴다(ocr.ts가 기본 OEM=LSTM으로 부른다). 브라우저가 SIMD 지원 여부에 따라 셋 중 하나를 고른다
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  const target = join(out, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(nm, from), target);
}
console.log(`tesseract 파일 ${files.length}개를 public/tesseract/에 복사했습니다.`);

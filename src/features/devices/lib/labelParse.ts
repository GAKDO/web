import type { DeviceModelSummary, DeviceOs } from "../../../shared/api/types";

/** 라벨 사진의 OCR 글자에서 뽑아낸 값. 못 읽은 값은 null이고, 관리자가 등록 전에 확인·수정한다 */
export interface LabelReading {
  serial: string | null;
  /** 라벨에 찍힌 모델 번호(예: A2681, 16Z90R, P54G) */
  modelNumber: string | null;
  manufacturer: string | null;
  os: DeviceOs | null;
}

// 시리얼 앞에 붙는 말. 긴 것부터 맞춰야 "Service Tag (S/N)"가 "S/N"보다 먼저 잡힌다
const SERIAL_RE =
  /(?:service\s*tag\s*\(\s*s\s*\/\s*n\s*\)|service\s*tag|serial\s*(?:no\.?|number|#)?|s\s*\/\s*n|\bsn)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9 \-]{5,24})/i;
// 모델 번호. "Model A2681", "Model: 16Z90R-K.AAC8U1", "Reg Model: P54G" 등
const MODEL_RE = /(?:reg(?:ulatory)?\s*)?model(?:\s*(?:no\.?|number|name))?\s*[:#.]?\s*([A-Z0-9]{3,12}(?:-[A-Z0-9]{1,4})?)/i;
// Apple 모델 번호는 A + 숫자 4자리
const APPLE_MODEL_RE = /\bA\s?(\d{4})\b/;

const MANUFACTURERS: { name: string; re: RegExp; os: DeviceOs }[] = [
  { name: "Apple", re: /apple|macbook|designed\s+by\s+apple/i, os: "MACOS" },
  { name: "LG", re: /\bLG\b|\bgram\b|LG\s*Electronics/i, os: "WINDOWS" },
  { name: "Dell", re: /\bdell\b|service\s*tag/i, os: "WINDOWS" },
  { name: "Samsung", re: /samsung/i, os: "WINDOWS" },
  { name: "Lenovo", re: /lenovo|thinkpad/i, os: "WINDOWS" },
];

/**
 * 시리얼 뒤에 이어진 글자(예: "EMC 3598")를 떼고 한 덩어리만 남긴다. 첫 덩어리가 너무 짧으면 OCR이 띄어 쓴 것으로 보고
 * 다음 덩어리와 붙인다. O/0처럼 헷갈리는 글자는 바꾸지 않고 사람에게 맡긴다
 */
function cleanToken(raw: string): string {
  const parts = raw.trim().toUpperCase().split(/[\s\-]+/).filter(Boolean);
  // 다른 항목의 머리말(예: "Serial:" 다음 줄의 "Model A2681")이 나오면 거기서 멈춘다
  const stop = parts.findIndex((p) => FIELD_WORDS.has(p.replace(/[^A-Z]/g, "")));
  const usable = stop === -1 ? parts : parts.slice(0, stop);
  let token = usable[0] ?? "";
  for (let i = 1; i < usable.length && token.length < 7; i++) token += usable[i];
  token = token.replace(/[^A-Z0-9]/g, "");
  // 시리얼에는 숫자가 하나는 들어 있다(글자만 있으면 다른 낱말로 본다)
  return /\d/.test(token) ? token : "";
}

/** 라벨에서 시리얼 다음에 올 수 있는 다른 항목의 머리말 */
const FIELD_WORDS = new Set(["MODEL", "REG", "REGULATORY", "EMC", "FCC", "FCCID", "RATING", "MADE", "DESIGNED", "ASSEMBLED", "MFD", "INPUT", "PN", "SKU"]);

/** OCR 글자 전체에서 시리얼·모델 번호·제조사를 뽑는다 */
export function parseLabelText(text: string): LabelReading {
  // 흩어진 글자 모드에선 "Serial:"과 값이 다른 줄로 나뉠 수 있어, 줄마다 본 뒤 한 줄로 이은 글자도 본다
  const lines = [...text.split(/\r?\n/), text.replace(/\s*\r?\n\s*/g, " ")];
  let serial: string | null = null;
  for (const line of lines) {
    const m = SERIAL_RE.exec(line);
    if (m?.[1]) {
      const token = cleanToken(m[1]);
      if (token.length >= 7 && token.length <= 20) {
        serial = token;
        break;
      }
    }
  }

  const maker = MANUFACTURERS.find((x) => x.re.test(text));
  let modelNumber: string | null = null;
  // Apple 라벨이거나 제조사를 못 읽었을 때만 "A1234" 꼴을 모델 번호로 본다
  const apple = !maker || maker.name === "Apple" ? APPLE_MODEL_RE.exec(text) : null;
  if (apple?.[1]) modelNumber = `A${apple[1]}`;
  if (!modelNumber) {
    for (const line of lines) {
      const m = MODEL_RE.exec(line);
      // 숫자가 하나는 있어야 모델 번호로 본다("Model Name" 같은 머리말 오인 방지)
      if (m?.[1] && /\d/.test(m[1])) {
        modelNumber = m[1].toUpperCase();
        break;
      }
    }
  }

  // 제조사 글자는 못 읽었어도 Apple 모델 번호가 보이면 Apple로 본다
  const resolved = maker ?? (apple ? MANUFACTURERS[0] : undefined);
  return { serial, modelNumber, manufacturer: resolved?.name ?? null, os: resolved?.os ?? null };
}

// 자주 쓰는 Apple 모델 번호 → 기종 이름에 들어 있어야 할 말. 기종 코드가 아니라 이름으로 맞춰 서버 기종표가 바뀌어도 따라간다
const APPLE_MODEL_HINTS: Record<string, string[]> = {
  A2337: ["MacBook Air", "M1"],
  A2681: ["MacBook Air", "M2"],
  A2941: ["MacBook Air", "15", "M2"],
  A3113: ["MacBook Air", "M3"],
  A3114: ["MacBook Air", "15", "M3"],
  A2442: ["MacBook Pro", "14"],
  A2779: ["MacBook Pro", "14", "M2"],
  A2918: ["MacBook Pro", "14", "M3"],
  A2992: ["MacBook Pro", "14", "M3"],
};

function includesAll(name: string, words: string[]): boolean {
  const lower = name.toLowerCase();
  return words.every((w) => lower.includes(w.toLowerCase()));
}

/**
 * 읽은 값으로 등록된 기종 하나를 고른다. 확실하지 않으면 null(관리자가 고른다).
 * 1) 기종 코드·이름에 모델 번호가 그대로 들어 있으면 그 기종(새 물건도 기종 이름에 모델 번호만 넣으면 맞춰진다)
 * 2) Apple 모델 번호 표의 이름 단서를 모두 가진 기종이 하나뿐이면 그 기종
 * 3) 제조사가 같은 기종이 하나뿐이면 그 기종
 */
export function matchModel(reading: LabelReading, models: DeviceModelSummary[]): string | null {
  const num = reading.modelNumber?.toLowerCase();
  let numberHits: DeviceModelSummary[] = [];
  let direct: DeviceModelSummary[] = [];
  if (num) {
    // 다른 코드의 일부(예: P54G ⊂ XP54G7)는 맞춘 것으로 보지 않는다. 앞뒤가 영숫자가 아니어야 한다(괄호·띄어쓰기·하이픈은 경계)
    const escaped = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bounded = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`);
    numberHits = models.filter((m) => bounded.test(m.modelCode.toLowerCase()) || bounded.test(m.name.toLowerCase()));
    // 제조사를 읽었다면 제조사가 다른 기종은 직접 일치로 보지 않는다(Dell 라벨에 다른 회사 기종이 골라지지 않게)
    const maker = reading.manufacturer?.toLowerCase();
    direct = maker ? numberHits.filter((m) => m.manufacturer?.toLowerCase() === maker) : numberHits;
    if (direct.length === 1) return direct[0]!.modelCode;
    const hints = APPLE_MODEL_HINTS[reading.modelNumber!];
    if (hints) {
      const hinted = models.filter((m) => includesAll(m.name, hints));
      if (hinted.length === 1) return hinted[0]!.modelCode;
    }
  }
  if (reading.manufacturer) {
    const same = models.filter((m) => m.manufacturer?.toLowerCase() === reading.manufacturer!.toLowerCase());
    // 모델 번호가 여러 기종과 맞았다면 그중 하나일 때만 제조사로 고른다(맞은 기종 밖의 기종을 고르지 않음)
    if (same.length === 1 && (numberHits.length === 0 || direct.includes(same[0]!))) return same[0]!.modelCode;
  }
  return null;
}

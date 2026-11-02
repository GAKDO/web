import type { Shot } from "./camera";
import type { Gray } from "./quality";

// 테스트용 합성 픽셀. 실제 사진 대신 선명함·흐림·반사를 흉내 낸다.
const SIZE = 64;

function gray(fn: (x: number, y: number) => number): Gray {
  const data = new Uint8ClampedArray(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) data[y * SIZE + x] = fn(x, y);
  return { width: SIZE, height: SIZE, data };
}

/** 무작위 결의 선명한 표면(seed마다 다름) */
export function sharpGray(seed = 1): Gray {
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return gray(() => 40 + rand() * 160);
}

/** 상자 흐림을 radius만큼 여러 번 건 사진(흔들림 흉내) */
export function blurredGray(seed = 1, radius = 3): Gray {
  let g = sharpGray(seed);
  for (let pass = 0; pass < 3; pass++) {
    const src = g.data;
    g = gray((x, y) => {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.min(SIZE - 1, Math.max(0, x + dx));
          const yy = Math.min(SIZE - 1, Math.max(0, y + dy));
          sum += src[yy * SIZE + xx];
          n++;
        }
      return sum / n;
    });
  }
  return g;
}

/** 선명하지만 가운데가 하얗게 날아간 사진(반사 흉내) */
export function glareGray(seed = 1): Gray {
  const base = sharpGray(seed);
  return gray((x, y) => (Math.abs(x - 32) < 12 && Math.abs(y - 32) < 12 ? 255 : base.data[y * SIZE + x]));
}

export function fakeShot(g: Gray, n = 0): Shot {
  const bytes = new Uint8Array([n, 1, 2, 3]).buffer;
  return { bytes, sha256: n.toString(16).padStart(64, "0"), takenAt: "2026-11-12T13:05:00+09:00", previewUrl: `blob:shot-${n}`, gray: g };
}

/** 바이트의 진짜 SHA-256을 가진 선명한 사진(업로드·완료 목이 해시를 대조한다) */
export async function hashedShot(n: number): Promise<Shot> {
  const bytes = new Uint8Array([n, 7, 7, 7]).buffer;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { ...fakeShot(sharpGray(n + 1), n), bytes, sha256 };
}

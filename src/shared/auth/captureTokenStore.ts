import type { CaptureTokenResponse } from "../api/types";

// 수령 QR을 바꿔 받은 촬영 권한(30분, 시점 하나). 로그인 토큰과 따로, 이 모듈 변수에만 둔다(WE2 FR-007).
export interface CaptureGrant {
  accessToken: string;
  rentalId: string;
  checkpointId: string;
  expiresAt: number;
}

let grant: CaptureGrant | null = null;
// clear()(로그인·로그아웃)마다 바뀐다. 그 전에 시작한 QR 교환 결과는 저장하지 않는다
let generation = 0;

export const captureTokenStore = {
  get: (): CaptureGrant | null => grant,
  generation: (): number => generation,
  set(token: CaptureTokenResponse): CaptureGrant {
    grant = {
      accessToken: token.accessToken,
      rentalId: token.rentalId,
      checkpointId: token.checkpointId,
      expiresAt: Date.now() + token.expiresIn * 1000,
    };
    return grant;
  },
  clear(): void {
    grant = null;
    generation += 1;
  },
};

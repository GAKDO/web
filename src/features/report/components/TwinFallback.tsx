import type { CaptureFace, CheckpointMedia } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";

const FACES: CaptureFace[] = ["TOP", "SCR0", "KB", "BOT", "SF", "SB", "SL", "SR"];

/** 3D를 그릴 수 없을 때 면별 사진(FR-010). 사진이 없는 면은 "사진 없음"(FR-008) */
export function TwinFallback({ media, reason }: { media: CheckpointMedia | undefined; reason: string }) {
  return (
    <div className="twin-fallback">
      <p role="status">{reason}</p>
      <ul className="face-grid" aria-label="면별 사진">
        {FACES.map((face) => {
          const texture = media?.textures.find((t) => t.face === face) ?? (face === "SCR0" ? media?.textures.find((t) => t.face === "SCR1") : undefined);
          return (
            <li key={face} aria-label={CAPTURE_FACE_LABEL[face]}>
              {texture ? <img src={texture.url} alt={`${CAPTURE_FACE_LABEL[face]} 사진`} /> : <span className="no-photo">사진 없음</span>}
              <small>{CAPTURE_FACE_LABEL[face]}</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

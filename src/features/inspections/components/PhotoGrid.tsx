import type { CSSProperties } from "react";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";
import type { FaceGrid, TextureOverlay } from "../model/photos";
import { formatConfidence } from "../model/verdict";
import { PhotoWithDefects } from "./PhotoWithDefects";

/** 빠른 검사(QUICK): 면마다 카메라 2(행) × 조명 3(열) 원본 사진 격자(11/3 A 답변), 사진 위에 그 사진의 흠집 */
export function PhotoGrid({ grids }: { grids: FaceGrid[] }) {
  return (
    <>
      {grids.map((grid) => (
        <section key={grid.face} aria-label={`${CAPTURE_FACE_LABEL[grid.face]} 사진`}>
          <h3>
            {CAPTURE_FACE_LABEL[grid.face]} · 흠집 {grid.defectCount}개
          </h3>
          <ul className="photo-grid" style={{ "--cols": grid.lights.length } as CSSProperties}>
            {grid.cells.map((cell) => {
              const name = `${CAPTURE_FACE_LABEL[cell.face]} ${cell.camera} ${cell.light}`;
              return (
                <li key={`${cell.camera}:${cell.light}`} aria-label={name}>
                  {cell.photo ? (
                    <PhotoWithDefects
                      src={cell.photo.url}
                      alt={`${name} 사진`}
                      defects={cell.defects.map((d) => ({ id: d.defectId, title: `${DEFECT_CLASS_LABEL[d.class]} ${formatConfidence(d.confidence)}`, polygon: d.polygon }))}
                    />
                  ) : (
                    <div className="photo photo-missing">사진 없음</div>
                  )}
                  <p className="muted">
                    {CAPTURE_CAMERA_LABEL[cell.camera]} · {CAPTURE_LIGHT_LABEL[cell.light]} · 흠집 {cell.defects.length}개
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/** 정합 세트: 면 사진(표준 좌표) 위에 그 면의 흠집 */
export function TextureList({ overlays }: { overlays: TextureOverlay[] }) {
  return (
    <ul className="photo-grid" style={{ "--cols": 2 } as CSSProperties} aria-label="면 사진">
      {overlays.map((o) => (
        <li key={o.face} aria-label={CAPTURE_FACE_LABEL[o.face]}>
          <PhotoWithDefects
            src={o.url}
            alt={`${CAPTURE_FACE_LABEL[o.face]} 사진`}
            defects={o.defects.map((d) => ({ id: d.defectId, title: `${DEFECT_CLASS_LABEL[d.class]} ${formatConfidence(d.confidence)}`, polygon: d.polygon }))}
          />
          <p className="muted">
            {CAPTURE_FACE_LABEL[o.face]} · 흠집 {o.defects.length}개
          </p>
        </li>
      ))}
    </ul>
  );
}

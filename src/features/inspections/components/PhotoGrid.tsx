import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "../../../shared/ui/useMediaQuery";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";
import type { FaceGrid, TextureOverlay } from "../model/photos";
import { formatConfidence } from "../model/verdict";
import { PhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";
import { PHOTO_MISSING, PhotoWithDefects } from "./PhotoWithDefects";
import type { PhotoDefect } from "../../../shared/api/types";

const overlayOf = (defects: PhotoDefect[]) =>
  defects.map((d) => ({ id: d.defectId, title: `${DEFECT_CLASS_LABEL[d.class]} ${formatConfidence(d.confidence)}`, polygon: d.polygon }));

/**
 * 빠른 검사(QUICK): 면마다 카메라 2(행) × 조명 3(열) 원본 사진 격자(11/3 A 답변), 사진 위에 그 사진의 흠집.
 * 12장을 모두 보이고(접지 않음) 칸마다 촬영 부위 이름을 붙인다. 사진을 누르면 크게 보기 팝업에서 차례로 넘긴다
 */
export function PhotoGrid({ grids }: { grids: FaceGrid[] }) {
  const [open, setOpen] = useState<number | null>(null);
  // 폰: 12장이 세로로 1000px 넘게 이어져 면(윗면·바닥) 탭으로 나눠 6장씩 본다. 768px 이상은 모두 펼친다
  const mobile = useIsMobile();
  const [face, setFace] = useState(grids[0]?.face);
  const shown = mobile && grids.length > 1 ? grids.filter((g) => g.face === face) : grids;
  const shots: LightboxPhoto[] = grids.flatMap((grid) =>
    grid.cells.flatMap((cell) =>
      cell.photo
        ? [
            {
              key: `${cell.face}:${cell.camera}:${cell.light}`,
              name: `${CAPTURE_FACE_LABEL[cell.face]} · ${CAPTURE_CAMERA_LABEL[cell.camera]} · ${CAPTURE_LIGHT_LABEL[cell.light]}`,
              src: cell.photo.url,
              defects: overlayOf(cell.defects),
            },
          ]
        : [],
    ),
  );
  return (
    <>
      {mobile && grids.length > 1 && (
        <div role="tablist" aria-label="사진 면" className="sticky top-14 z-10 -mx-4 mb-1 flex gap-1 bg-background/95 px-4 py-2 backdrop-blur">
          {grids.map((g, i) => (
            <button
              key={g.face}
              type="button"
              role="tab"
              id={`face-tab-${g.face}`}
              aria-controls={`face-panel-${g.face}`}
              aria-selected={g.face === face}
              tabIndex={g.face === face ? 0 : -1}
              onClick={() => setFace(g.face)}
              onKeyDown={(e) => {
                // 좌우 방향키로 옆 면으로(끝에서는 반대쪽 끝으로)
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next = grids[(i + (e.key === "ArrowRight" ? 1 : grids.length - 1)) % grids.length];
                setFace(next.face);
                document.getElementById(`face-tab-${next.face}`)?.focus();
              }}
              className={cn(
                "flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-[color,background-color,border-color,box-shadow,scale] duration-200 active:scale-[0.97] motion-reduce:scale-none",
                g.face === face ? "border-foreground bg-foreground text-background shadow-sm" : "bg-card text-muted-foreground",
              )}
            >
              {CAPTURE_FACE_LABEL[g.face]}
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold", g.defectCount > 0 ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>{g.defectCount}</span>
            </button>
          ))}
        </div>
      )}
      {shown.map((grid) => (
        <section
          key={grid.face}
          id={`face-panel-${grid.face}`}
          {...(mobile && grids.length > 1 ? { role: "tabpanel", "aria-labelledby": `face-tab-${grid.face}` } : {})}
          aria-label={`${CAPTURE_FACE_LABEL[grid.face]} 사진`}
          className="animate-enter"
        >
          <h3 className="mt-4 mb-2 text-base font-semibold">
            {CAPTURE_FACE_LABEL[grid.face]} · 흠집 {grid.defectCount}개
          </h3>
          <ul className="m-0 mb-4 grid list-none grid-cols-[repeat(var(--cols,3),minmax(0,1fr))] gap-2 p-0 md:gap-3" style={{ "--cols": grid.lights.length } as CSSProperties}>
            {grid.cells.map((cell) => {
              const name = `${CAPTURE_FACE_LABEL[cell.face]} ${cell.camera} ${cell.light}`;
              const shot = shots.findIndex((p) => p.key === `${cell.face}:${cell.camera}:${cell.light}`);
              return (
                <li key={`${cell.camera}:${cell.light}`} aria-label={name}>
                  {cell.photo ? (
                    <PhotoWithDefects src={cell.photo.url} alt={`${name} 사진`} defects={overlayOf(cell.defects)} onOpen={() => setOpen(shot)} />
                  ) : (
                    <div className={PHOTO_MISSING}>사진 없음</div>
                  )}
                  <p className="mt-1 mb-0 grid text-[13px] leading-snug">
                    {!(mobile && grids.length > 1) && <strong>{CAPTURE_FACE_LABEL[cell.face]}</strong>}
                    <span className="text-muted-foreground">
                      {CAPTURE_CAMERA_LABEL[cell.camera]} · {CAPTURE_LIGHT_LABEL[cell.light]} · 흠집 {cell.defects.length}개
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {open !== null && <PhotoLightbox photos={shots} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

/** 정합 세트: 면 사진(표준 좌표) 위에 그 면의 흠집 */
export function TextureList({ overlays }: { overlays: TextureOverlay[] }) {
  return (
    <ul className="m-0 mb-4 grid list-none grid-cols-[repeat(var(--cols,3),minmax(0,1fr))] gap-2 p-0 md:gap-3" style={{ "--cols": 2 } as CSSProperties} aria-label="면 사진">
      {overlays.map((o) => (
        <li key={o.face} aria-label={CAPTURE_FACE_LABEL[o.face]}>
          <PhotoWithDefects
            src={o.url}
            alt={`${CAPTURE_FACE_LABEL[o.face]} 사진`}
            defects={o.defects.map((d) => ({ id: d.defectId, title: `${DEFECT_CLASS_LABEL[d.class]} ${formatConfidence(d.confidence)}`, polygon: d.polygon }))}
          />
          <p className="mt-1 mb-0 text-[13px] text-muted-foreground">
            {CAPTURE_FACE_LABEL[o.face]} · 흠집 {o.defects.length}개
          </p>
        </li>
      ))}
    </ul>
  );
}

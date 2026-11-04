import { useEffect, useRef } from "react";
import { PhotoWithDefects, type OverlayDefect } from "./PhotoWithDefects";

export interface LightboxPhoto {
  key: string;
  /** 촬영 부위 이름(예: "윗면(덮개) · CAM1 앞 반 · L1 확산") */
  name: string;
  src: string;
  defects: OverlayDefect[];
}

interface Props {
  photos: LightboxPhoto[];
  index: number;
  onIndex(index: number): void;
  onClose(): void;
}

/**
 * 사진 크게 보기 팝업. 이전·다음(←·→)으로 같은 시점의 사진을 차례로 넘기고 닫기(Esc)로 닫는다.
 * 별도 주소(페이지)를 만들지 않는다. 열면 닫기 버튼에 초점을 두고, 닫으면 누른 사진으로 초점을 돌린다
 */
export function PhotoLightbox({ photos, index, onIndex, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  // 마지막(또는 첫) 사진으로 넘겨 누른 버튼이 꺼지면 초점이 사라져 키가 안 먹을 수 있으니 닫기 버튼으로 옮긴다
  useEffect(() => {
    const active = document.activeElement;
    const lost = active === null || active === document.body || (active instanceof HTMLButtonElement && active.disabled);
    if (lost) closeRef.current?.focus();
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab") {
        // 열린 동안 Tab·Shift+Tab 초점이 팝업 밖(가려진 화면)으로 나가지 않게 한다
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? []);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const inside = dialogRef.current?.contains(document.activeElement) ?? false;
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onIndex, onClose]);

  if (!photo) return null;
  return (
    <div
      ref={dialogRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`사진 크게 보기: ${photo.name}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="lightbox-body">
        <div className="lightbox-head">
          <p>
            <strong>{photo.name}</strong> · 흠집 {photo.defects.length}개
          </p>
          <span className="muted">
            {index + 1} / {photos.length}
          </span>
          <button ref={closeRef} type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <PhotoWithDefects src={photo.src} alt={`${photo.name} 큰 사진`} defects={photo.defects} />
        <div className="row lightbox-nav">
          <button type="button" disabled={!hasPrev} onClick={() => onIndex(index - 1)}>
            ← 이전 사진
          </button>
          <button type="button" disabled={!hasNext} onClick={() => onIndex(index + 1)}>
            다음 사진 →
          </button>
        </div>
      </div>
    </div>
  );
}

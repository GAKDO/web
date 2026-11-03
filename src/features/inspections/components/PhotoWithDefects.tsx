import { useState } from "react";
import { polygonPoints } from "../model/photos";

export interface OverlayDefect {
  id: string;
  /** 폴리곤 위에 올리면 보이는 설명 */
  title: string;
  polygon: number[][];
}

/**
 * 사진 위에 흠집 폴리곤을 겹친다. 폴리곤 좌표는 사진 px(원본 사진이면 원본 px, 면 사진이면 표준 좌표)라
 * 사진이 로드된 뒤 natural 크기를 SVG viewBox로 써서 화면 크기와 상관없이 같은 자리에 그린다. 누르면 원본을 새 탭에 연다
 */
export function PhotoWithDefects({ src, alt, defects }: { src: string; alt: string; defects: OverlayDefect[] }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <a className="photo" href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt={alt}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) setSize({ width: naturalWidth, height: naturalHeight });
        }}
      />
      {size && defects.length > 0 && (
        <svg className="photo-overlay" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" role="img" aria-label={`흠집 ${defects.length}개 표시`}>
          {defects.map((d) => (
            <polygon key={d.id} points={polygonPoints(d.polygon)} vectorEffect="non-scaling-stroke">
              <title>{d.title}</title>
            </polygon>
          ))}
        </svg>
      )}
    </a>
  );
}

import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { polygonPoints } from "../model/photos";

export interface OverlayDefect {
  id: string;
  /** 폴리곤 위에 올리면 보이는 설명 */
  title: string;
  polygon: number[][];
}

/**
 * 사진 위에 흠집 폴리곤을 겹친다. 폴리곤 좌표는 사진 px(원본 사진이면 원본 px, 면 사진이면 표준 좌표)라
 * 사진이 로드된 뒤 natural 크기를 SVG viewBox로 써서 화면 크기와 상관없이 같은 자리에 그린다.
 * onOpen이 있으면 누를 때 크게 보기 팝업을 열고, 없으면(팝업 안) 원본을 새 탭에 연다.
 * 사진 주소(사전 서명 URL)를 못 읽으면 깨진 그림 대신 안내와 다시 시도를 보인다
 */
export function PhotoWithDefects({ src, alt, defects, onOpen }: { src: string; alt: string; defects: OverlayDefect[]; onOpen?: () => void }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // 실패는 그 주소에만 매어 둔다: 사진 주소가 새로 발급되면(만료 전 갱신) 따로 누르지 않아도 새 주소로 다시 읽는다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  if (failedSrc === src) {
    return (
      <div className="photo photo-missing" role="group" aria-label={alt}>
        <span>사진을 불러오지 못함</span>
        <Button
          onClick={() => {
            setFailedSrc(null);
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }
  const body = (
    <>
      <img
        key={attempt}
        src={src}
        alt={alt}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) setSize({ width: naturalWidth, height: naturalHeight });
        }}
        onError={() => {
          setSize(null);
          setFailedSrc(src);
        }}
      />
      {size && defects.length > 0 && (
        <svg
          className="photo-overlay"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`흠집 ${defects.length}개 표시`}
        >
          {defects.map((d) => (
            <polygon key={d.id} points={polygonPoints(d.polygon)} vectorEffect="non-scaling-stroke">
              <title>{d.title}</title>
            </polygon>
          ))}
        </svg>
      )}
    </>
  );
  if (onOpen) {
    return (
      <button type="button" className="photo photo-button" aria-label={`${alt} 크게 보기`} onClick={onOpen}>
        {body}
      </button>
    );
  }
  return (
    <a className="photo" href={src} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  );
}

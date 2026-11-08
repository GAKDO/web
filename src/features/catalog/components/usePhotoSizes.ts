import { useEffect, useState } from "react";
import type { Size } from "../model/laptop3d";

/**
 * 사진 원본 크기(px)를 읽는다. 흠집 좌표가 원본 px라 3D 핀 위치를 비율로 바꾸려면 필요하다.
 * 못 읽은 사진은 빠진다(부르는 쪽이 부스 기본 해상도로 대신한다). 주소가 바뀌어도(사전 서명 갱신) 키는 면·카메라·조명이라 다시 읽지 않는다
 */
export function usePhotoSizes(photos: { key: string; url: string }[]): Record<string, Size> {
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const wanted = photos.filter((p) => !sizes[p.key]);
  const signature = wanted.map((p) => p.key).join("|");
  useEffect(() => {
    let alive = true;
    for (const p of wanted) {
      const img = new Image();
      img.onload = () => {
        if (alive && img.naturalWidth > 0 && img.naturalHeight > 0) setSizes((s) => ({ ...s, [p.key]: { width: img.naturalWidth, height: img.naturalHeight } }));
      };
      img.src = p.url;
    }
    return () => {
      alive = false;
    };
    // 새로 읽을 사진 목록이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return sizes;
}

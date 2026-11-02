import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CaptureFace, CheckpointMedia } from "../../../shared/api/types";
import type { TextureSize } from "../model/pins";

export interface LoadedTexture {
  texture: THREE.Texture;
  size: TextureSize;
}

export interface TextureState {
  loaded: Partial<Record<CaptureFace, LoadedTexture>>;
  /** 사진 주소는 있었지만 읽지 못한 면. 화면에서는 회색으로 두고 안내만 한다 */
  failed: CaptureFace[];
}

/**
 * 사진 보기 주소로 면 텍스처를 읽는다.
 * - 시점이 바뀌면 이전 텍스처를 비운다.
 * - 같은 시점에서 주소만 바뀌면(만료 전 새 주소) 다시 읽되, 새 텍스처가 올 때까지 이전 것을 보여 준다.
 * - 화면에서 빠진 텍스처는 GPU 메모리를 풀어 준다.
 */
export function useTextures(media: CheckpointMedia | undefined): TextureState {
  const [loaded, setLoaded] = useState<TextureState["loaded"]>({});
  const [failed, setFailed] = useState<CaptureFace[]>([]);
  const urlKey = (media?.textures ?? []).map(({ face, url }) => `${face}:${url}`).join("|");

  useEffect(() => {
    setLoaded({});
    setFailed([]);
  }, [media?.checkpointId]);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    for (const { face, url } of media?.textures ?? []) {
      loader.load(
        url,
        (texture) => {
          if (!alive) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          const image = texture.image as HTMLImageElement;
          const size = { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
          setLoaded((prev) => ({ ...prev, [face]: { texture, size } }));
          setFailed((prev) => prev.filter((f) => f !== face));
        },
        undefined,
        () => {
          if (!alive) return;
          setFailed((prev) => (prev.includes(face) ? prev : [...prev, face]));
        },
      );
    }
    return () => {
      alive = false;
    };
    // urlKey가 media.textures의 면·주소를 모두 담는다
  }, [urlKey]);

  // 화면에 그린 뒤, 이전 상태에만 있던 텍스처를 해제한다
  const shown = useRef<THREE.Texture[]>([]);
  useEffect(() => {
    const current = Object.values(loaded).map((l) => l.texture);
    for (const t of shown.current) if (!current.includes(t)) t.dispose();
    shown.current = current;
  }, [loaded]);
  useEffect(
    () => () => {
      for (const t of shown.current) t.dispose();
      shown.current = [];
    },
    [],
  );

  return { loaded, failed };
}

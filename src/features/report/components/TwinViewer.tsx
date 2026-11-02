import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import * as THREE from "three";
import type { CaptureFace, CheckpointMedia, Pin } from "../../../shared/api/types";
import { faceNormal, lidInnerFace, pinPosition, pinRatio, type Dimensions, type TextureSize } from "../model/pins";

// 3D 트윈(FR-RPT-01·02). 리포트 화면에서만 지연 로딩한다. 단위는 mm, 화면 상자는 110° 열린 모습 하나(명세 Q2)
const OPEN_DEG = 110;
const GRAY = new THREE.MeshStandardMaterial({ color: "#b8bec7" });

interface Loaded {
  texture: THREE.Texture;
  size: TextureSize;
}

/** 사진 보기 주소로 텍스처를 읽는다. 주소가 바뀌어도(만료 전 새 주소) 같은 면이면 바꿔 끼운다 */
function useTextures(media: CheckpointMedia | undefined): Partial<Record<CaptureFace, Loaded>> {
  const [loaded, setLoaded] = useState<Partial<Record<CaptureFace, Loaded>>>({});
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    setLoaded({});
    for (const { face, url } of media?.textures ?? []) {
      loader.load(url, (texture) => {
        if (!alive) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        const image = texture.image as HTMLImageElement;
        setLoaded((prev) => ({ ...prev, [face]: { texture, size: { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height } } }));
      });
    }
    return () => {
      alive = false;
    };
    // 같은 시점의 새 주소는 바꿔 끼우지 않아도 된다: 사진 내용이 같다
  }, [media?.checkpointId]);
  return loaded;
}

function material(loaded: Loaded | undefined): THREE.Material {
  return loaded ? new THREE.MeshStandardMaterial({ map: loaded.texture }) : GRAY;
}

interface Props {
  dimensions: Dimensions;
  media: CheckpointMedia | undefined;
  pins: Pin[];
  selected: string | null;
  onSelect(pin: Pin): void;
}

export default function TwinViewer({ dimensions: d, media, pins, selected, onSelect }: Props) {
  const textures = useTextures(media);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const inner = lidInnerFace(Object.keys(textures) as CaptureFace[]);
  // BoxGeometry 재질 순서: +x, −x, +y, −y, +z, −z
  const baseMaterials = useMemo(
    () => [material(textures.SR), material(textures.SL), material(textures.KB), material(textures.BOT), material(textures.SF), material(textures.SB)],
    [textures],
  );
  const lidMaterials = useMemo(() => [GRAY, GRAY, material(textures.TOP), material(inner ? textures[inner] : undefined), GRAY, GRAY], [textures, inner]);
  const angle = (OPEN_DEG * Math.PI) / 180;
  const size = Math.max(d.widthMm, d.depthMm);

  return (
    <div className="twin-canvas">
      <Canvas camera={{ position: [0, size * 0.9, size * 1.4], fov: 40, near: 1, far: size * 20 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[size, size * 2, size]} intensity={1.2} />
        <group position={[0, -d.depthMm * 0.3, 0]}>
          <mesh material={baseMaterials}>
            <boxGeometry args={[d.widthMm, d.baseHMm, d.depthMm]} />
          </mesh>
          <group position={[0, d.baseHMm / 2, -d.depthMm / 2]} rotation={[-angle, 0, 0]}>
            <mesh position={[0, d.lidHMm / 2, d.depthMm / 2]} material={lidMaterials}>
              <boxGeometry args={[d.widthMm, d.lidHMm, d.depthMm]} />
            </mesh>
          </group>
          {pins.map((pin) => {
            const face = pin.face === "SCR1" && inner === "SCR1" ? "SCR1" : pin.face;
            const ratio = pinRatio(pin, textures[face]?.size);
            if (!ratio) return null;
            const radius = pin.isNew ? 4 : 3;
            const normal = faceNormal(face, OPEN_DEG);
            const at = pinPosition(face, ratio, d, OPEN_DEG);
            // 면 위로 반지름의 절반만큼 띄우고, 고리는 면에 눕힌다
            const position: [number, number, number] = [at[0] + normal[0] * radius * 0.5, at[1] + normal[1] * radius * 0.5, at[2] + normal[2] * radius * 0.5];
            const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
            return (
              <mesh
                key={pin.defectId}
                position={position}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(pin);
                }}
              >
                <sphereGeometry args={[selected === pin.defectId ? radius * 1.5 : radius, 16, 16]} />
                <meshStandardMaterial color={pin.isNew ? "#f97316" : "#2563eb"} />
                {pin.isNew && (
                  // 신규는 색에 더해 고리 모양으로도 구분한다(FR-013). 글자 "신규"는 옆 흠집 목록에 있다
                  <mesh quaternion={facing}>
                    <torusGeometry args={[radius * 2.2, radius * 0.35, 8, 32]} />
                    <meshStandardMaterial color="#f97316" />
                  </mesh>
                )}
              </mesh>
            );
          })}
        </group>
        <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={size * 0.5} maxDistance={size * 4} />
      </Canvas>
      <button type="button" className="twin-reset" onClick={() => controls.current?.reset()}>
        처음 보기
      </button>
    </div>
  );
}

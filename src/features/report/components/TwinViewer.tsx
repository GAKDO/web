import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import type { CaptureFace, CheckpointMedia, Pin } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { useTextures, type LoadedTexture } from "../hooks/useTextures";
import { faceNormal, lidInnerFace, pinPosition, pinRatio, type Dimensions } from "../model/pins";

// 3D 트윈(FR-RPT-01·02). 리포트 화면에서만 지연 로딩한다. 단위는 mm, 화면 상자는 110° 열린 모습 하나(명세 Q2)
const OPEN_DEG = 110;
const GRAY = new THREE.MeshStandardMaterial({ color: "#b8bec7" });

function material(loaded: LoadedTexture | undefined): THREE.Material {
  return loaded ? new THREE.MeshStandardMaterial({ map: loaded.texture }) : GRAY;
}

/** 재질 묶음이 바뀌거나 화면이 닫히면 이전 재질을 해제한다. 공유 재질 GRAY는 남긴다 */
function useDisposeMaterials(materials: THREE.Material[]): void {
  useEffect(
    () => () => {
      for (const m of materials) if (m !== GRAY) m.dispose();
    },
    [materials],
  );
}

interface Props {
  dimensions: Dimensions;
  media: CheckpointMedia | undefined;
  pins: Pin[];
  selected: string | null;
  onSelect(pin: Pin): void;
}

export default function TwinViewer({ dimensions: d, media, pins, selected, onSelect }: Props) {
  const { loaded: textures, failed } = useTextures(media);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const inner = lidInnerFace(Object.keys(textures) as CaptureFace[]);
  // BoxGeometry 재질 순서: +x, −x, +y, −y, +z, −z
  const baseMaterials = useMemo(
    () => [material(textures.SR), material(textures.SL), material(textures.KB), material(textures.BOT), material(textures.SF), material(textures.SB)],
    [textures],
  );
  const lidMaterials = useMemo(() => [GRAY, GRAY, material(textures.TOP), material(inner ? textures[inner] : undefined), GRAY, GRAY], [textures, inner]);
  useDisposeMaterials(baseMaterials);
  useDisposeMaterials(lidMaterials);
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
      {failed.length > 0 && (
        <p role="status" className="muted">
          {failed.map((f) => CAPTURE_FACE_LABEL[f]).join(", ")} 사진을 불러오지 못해 회색으로 표시했습니다.
        </p>
      )}
    </div>
  );
}

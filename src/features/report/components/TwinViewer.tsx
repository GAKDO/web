import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import type { CaptureFace, CheckpointMedia, Pin } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL } from "../../../shared/codes/labels";
import { useTextures, type LoadedTexture } from "../hooks/useTextures";
import { prefersReducedMotion } from "../../../shared/motion/usePlayback";
import { lidInnerFace, pinPlacement, pinRatio, sideBaseShare, type Dimensions } from "../model/pins";

// 3D 트윈(FR-RPT-01·02). 리포트 화면에서만 지연 로딩한다. 단위는 mm, 화면 상자는 110° 열린 모습 하나(명세 Q2)
const OPEN_DEG = 110;
const GRAY = new THREE.MeshStandardMaterial({ color: "#b8bec7" });
/** 핀 색(11/8 민서): 서버가 신규(isNew)로 판정한 흠집만 빨강, 앞 시점부터 있던 흠집은 회색 */
const PIN_NEW = "#c8161d";
const PIN_KNOWN = "#6b7280";

interface View {
  /** 사진의 아래에서부터 이 비율만 쓴다(옆면을 본체·덮개로 나눌 때). 기본 [0, 1] */
  rows?: [number, number];
  /** 180° 돌린다(바닥 사진은 왼쪽이 사용자 오른쪽이라 상자 기본 방향과 반대) */
  flip?: boolean;
}

/** 면 사진을 상자 면에 입힌다. 방향은 contracts capture/faces.md와 three.js BoxGeometry의 면 UV를 맞춘 것이다 */
function material(loaded: LoadedTexture | undefined, view: View = {}): THREE.Material {
  if (!loaded) return GRAY;
  const [from, to] = view.rows ?? [0, 1];
  if (to <= from) return GRAY;
  let map = loaded.texture;
  if (view.flip || from !== 0 || to !== 1) {
    // 잘라 보거나 돌린 사본. 이미지는 공유하고, 사본은 재질과 함께 해제한다
    map = loaded.texture.clone();
    map.userData.view = true;
    map.offset.set(0, from);
    map.repeat.set(1, to - from);
    if (view.flip) {
      map.center.set(0.5, 0.5);
      map.rotation = Math.PI;
    }
    map.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map });
}

/** 재질 묶음이 바뀌거나 화면이 닫히면 이전 재질과 잘라 본 텍스처 사본을 해제한다. 공유 재질 GRAY는 남긴다 */
function useDisposeMaterials(materials: THREE.Material[]): void {
  useEffect(
    () => () => {
      for (const m of materials) {
        if (m === GRAY) continue;
        const map = (m as THREE.MeshStandardMaterial).map;
        if (map?.userData.view) map.dispose();
        m.dispose();
      }
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
  // 옆면 사진은 닫힌 상태 전체 높이(본체+덮개)라, 아래 부분은 본체 옆에, 위 부분은 덮개 옆 모서리에 입힌다
  const share = sideBaseShare(d);
  const base: View = { rows: [0, share] };
  const lid: View = { rows: [share, 1] };
  // BoxGeometry 재질 순서: +x, −x, +y, −y, +z, −z
  const baseMaterials = useMemo(
    () => [
      material(textures.SR, base),
      material(textures.SL, base),
      material(textures.KB),
      material(textures.BOT, { flip: true }),
      material(textures.SF, base),
      material(textures.SB, base),
    ],
    // base·lid는 share에서만 나온다
    [textures, share],
  );
  // 덮개는 닫힌 자세로 만든 뒤 경첩에서 돌리므로, 닫힌 상태의 면 방향이 그대로 맞는다
  const lidMaterials = useMemo(
    () => [
      material(textures.SR, lid),
      material(textures.SL, lid),
      material(textures.TOP),
      material(inner ? textures[inner] : undefined),
      material(textures.SF, lid),
      material(textures.SB, lid),
    ],
    [textures, inner, share],
  );
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
            const { position: at, normal } = pinPlacement(face, ratio, d, OPEN_DEG);
            // 면 위로 반지름의 절반만큼 띄우고, 고리는 면에 눕힌다
            const position: [number, number, number] = [at[0] + normal[0] * radius * 0.5, at[1] + normal[1] * radius * 0.5, at[2] + normal[2] * radius * 0.5];
            return (
              <PinMark
                key={pin.defectId}
                pin={pin}
                position={position}
                normal={normal}
                radius={radius}
                selected={selected === pin.defectId}
                onSelect={onSelect}
              />
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

/**
 * 핀 하나. 신규는 빨간 공 + 면에 눕힌 고리 + "신규" 이름표, 기존은 회색 공만.
 * 신규 고리는 천천히 숨 쉬듯 커졌다 줄어 눈에 띄게 하고, 움직임 줄이기 설정이면 멈춰 둔다
 */
function PinMark({
  pin,
  position,
  normal,
  radius,
  selected,
  onSelect,
}: {
  pin: Pin;
  position: [number, number, number];
  normal: [number, number, number];
  radius: number;
  selected: boolean;
  onSelect(pin: Pin): void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const still = useMemo(prefersReducedMotion, []);
  const facing = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal)), [normal[0], normal[1], normal[2]]);
  useFrame(({ clock }) => {
    if (!ring.current || still) return;
    const k = 1 + 0.25 * Math.sin(clock.elapsedTime * 3);
    ring.current.scale.setScalar(k);
  });
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(pin);
      }}
    >
      <sphereGeometry args={[selected ? radius * 1.5 : radius, 16, 16]} />
      <meshStandardMaterial color={pin.isNew ? PIN_NEW : PIN_KNOWN} />
      {pin.isNew && (
        <>
          {/* 신규는 색에 더해 고리 모양과 글자로도 구분한다(FR-013) */}
          <mesh ref={ring} quaternion={facing}>
            <torusGeometry args={[radius * 2.2, radius * 0.35, 8, 32]} />
            <meshStandardMaterial color={PIN_NEW} />
          </mesh>
          <Html center zIndexRange={[10, 0]}>
            <span aria-hidden="true" className="m-pin-tag">
              신규
            </span>
          </Html>
        </>
      )}
    </mesh>
  );
}

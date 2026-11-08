import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import type { Pin } from "../../../shared/api/types";
import { placeOnLaptop, type Size, type Vec3 } from "../../../shared/laptop3d/faces";
import { LaptopModel, profileFor } from "../../../shared/laptop3d/LaptopModel";
import { standardFaceSize, type FaceShape } from "../../../shared/laptop3d/shapes";
import { prefersReducedMotion } from "../../../shared/motion/usePlayback";
import { SHAPE_KNOWN, SHAPE_NEW } from "../model/twinShapes";
import { pinRatio, type Dimensions } from "../model/pins";

// 리포트 3D(FR-RPT-01·02, 11/8 민서 요청으로 바꿈): 사진을 상자에 입히던 방식 대신, 등록 기종의 고품질 노트북 모델 위에
// 실제 탐지된 흠집 모양(서버 폴리곤)을 그린다. 원본 사진은 핀을 눌러 상세에서 본다. 리포트 화면에서만 지연 로딩한다.

/** 핀 색(11/8 민서): 서버가 신규(isNew)로 판정한 흠집만 빨강, 앞 시점부터 있던 흠집은 회색 */
const PIN_NEW = SHAPE_NEW;
const PIN_KNOWN = SHAPE_KNOWN;
const BODY = "#c9ccd1";

interface Props {
  dimensions: Dimensions;
  modelCode: string;
  /** 면별 표준 좌표 이미지 크기(텍스처를 읽었으면). 없으면 치수 × 4 px/mm */
  sizes: Partial<Record<string, Size>>;
  shapes: FaceShape[];
  pins: Pin[];
  selected: string | null;
  onSelect(pin: Pin): void;
}

export default function TwinViewer({ dimensions: d, modelCode, sizes, shapes, pins, selected, onSelect }: Props) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const profile = useMemo(() => profileFor(modelCode), [modelCode]);
  const size = Math.max(d.widthMm, d.depthMm);
  const placed = pins.flatMap((pin) => {
    const ratio = pinRatio(pin, sizes[pin.face] ?? standardFaceSize(pin.face, d));
    if (!ratio) return [];
    return [{ pin, ...placeOnLaptop(pin.face, ratio, d) }];
  });
  const mark = (p: (typeof placed)[number]) => {
    const radius = size * (p.pin.isNew ? 0.006 : 0.005);
    const position: Vec3 = [p.position[0] + p.normal[0] * radius * 0.6, p.position[1] + p.normal[1] * radius * 0.6, p.position[2] + p.normal[2] * radius * 0.6];
    return <PinMark key={p.pin.defectId} pin={p.pin} position={position} normal={p.normal} radius={radius} selected={selected === p.pin.defectId} onSelect={onSelect} />;
  };

  return (
    <div className="twin-canvas">
      <Canvas camera={{ position: [size * 0.15, size * 0.6, size * 1.3], fov: 38, near: 1, far: size * 20 }} dpr={[1, 2]}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[size, size * 2, size]} intensity={1.1} />
        <directionalLight position={[-size, size * 0.6, -size]} intensity={0.35} />
        <group position={[0, -d.depthMm * 0.12, 0]}>
          <LaptopModel
            dimensions={d}
            color={BODY}
            profile={profile}
            shapes={shapes}
            baseChildren={placed.filter((p) => p.part === "base").map(mark)}
            lidChildren={placed.filter((p) => p.part === "lid").map(mark)}
          />
          <ContactShadows position={[0, -d.baseHMm / 2 - 0.6, 0]} scale={size * 1.35} blur={2.8} opacity={0.32} far={size * 0.25} />
        </group>
        <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={size * 0.45} maxDistance={size * 3.5} />
        <FaceCamera face={pins.find((p) => p.defectId === selected)?.face ?? null} size={size} controls={controls} />
      </Canvas>
      <button type="button" className="twin-reset" onClick={() => controls.current?.reset()}>
        처음 보기
      </button>
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
  const self = useRef<THREE.Mesh>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const still = useMemo(prefersReducedMotion, []);
  const tmp = useMemo(() => ({ n: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const facing = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal)), [normal[0], normal[1], normal[2]]);
  useFrame(({ clock, camera }) => {
    // 이름표(HTML)는 모델에 가려지지 않으므로, 핀이 붙은 면이 카메라 반대쪽을 보면 숨긴다(덮개 뒤 흠집이 화면 위로 비치지 않게)
    if (self.current && tag.current) {
      self.current.getWorldQuaternion(tmp.q);
      self.current.getWorldPosition(tmp.p);
      tmp.n.set(...normal).applyQuaternion(tmp.q);
      const visible = tmp.n.dot(camera.position.clone().sub(tmp.p)) > 0;
      tag.current.style.visibility = visible ? "visible" : "hidden";
    }
    if (!ring.current || still) return;
    const k = 1 + 0.25 * Math.sin(clock.elapsedTime * 3);
    ring.current.scale.setScalar(k);
  });
  return (
    <mesh
      ref={self}
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
            <span ref={tag} aria-hidden="true" className="m-pin-tag">
              신규
            </span>
          </Html>
        </>
      )}
    </mesh>
  );
}

/** 흠집을 고르면 그 면이 보이는 쪽으로 카메라를 옮긴다(덮개는 110° 열린 자세). 도착하면 다시 자유롭게 돌릴 수 있다 */
function FaceCamera({ face, size, controls }: { face: Pin["face"] | null; size: number; controls: React.RefObject<ElementRef<typeof OrbitControls>> }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    if (!face) return;
    const at: Record<Pin["face"], Vec3> = {
      TOP: [size * 0.2, size * 1.05, -size * 1.55],
      KB: [0, size * 1.05, size * 0.75],
      SCR0: [0, size * 0.45, size * 1.3],
      SCR1: [0, size * 0.45, size * 1.3],
      BOT: [size * 0.1, -size * 1.35, size * 0.3],
      SF: [0, size * 0.15, size * 1.1],
      SB: [0, size * 0.25, -size * 1.1],
      SL: [-size * 1.15, size * 0.3, size * 0.1],
      SR: [size * 1.15, size * 0.3, size * 0.1],
    };
    goal.current = new THREE.Vector3(...at[face]);
  }, [face, size]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, Math.min(1, dt * 4));
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < size * 0.01) goal.current = null;
  });
  return null;
}

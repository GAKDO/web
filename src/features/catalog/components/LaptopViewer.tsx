import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import type { ModelDimensions } from "../../../shared/api/types";
import { cameraNear, LaptopModel, profileFor } from "../../../shared/laptop3d/LaptopModel";
import type { FaceShape } from "../../../shared/laptop3d/shapes";
import { bodyColor, PIN_COLOR, type LaptopPin } from "../model/laptop3d";

// 노트북 3D 모델 + 실제 흠집 모양 + 핀(11/8 민서 요청). 모델은 shared/laptop3d의 등록 기종 모델(치수·겉모습)을 쓰고,
// 흠집은 서버 폴리곤 모양 그대로 면 위에 그린다. 핀은 누르기 위한 작은 표시다.
// 기기 상세에서만 지연 로딩한다(three.js가 크다). 덮개 쪽 핀·모양은 덮개 그룹 안에 있어 함께 돈다.

export type ViewPreset = "front" | "top" | "bottom" | "keyboard";

interface Props {
  dimensions: ModelDimensions;
  modelCode: string;
  color: string | null;
  pins: LaptopPin[];
  /** 핀별 짧은 표시(처음 발견 검사). 고른 핀 옆에 띄운다 */
  tags?: Record<string, string>;
  selected: string | null;
  onSelect(groupId: string): void;
  view: ViewPreset;
  /** 시점 버튼을 누를 때마다 늘린다(같은 시점을 다시 눌러도 카메라를 그 자리로 되돌리게) */
  viewNonce: number;
  lidOpen: boolean;
  /** 그래픽 장치가 3D 판을 거둬 갔을 때(탭이 많거나 GPU가 바쁠 때). 부모가 다시 그리기 버튼을 보인다 */
  onContextLost?(): void;
}

/** 시점 버튼: 카메라를 그 자리로 옮기고, 도착하면 사용자가 자유롭게 돌리게 놓아 준다 */
function CameraRig({ view, nonce, size, controls }: { view: ViewPreset; nonce: number; size: number; controls: React.RefObject<ElementRef<typeof OrbitControls>> }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    const at: Record<ViewPreset, [number, number, number]> = {
      front: [size * 0.15, size * 0.55, size * 1.3],
      top: [0, size * 1.55, size * 0.05],
      bottom: [0, -size * 1.55, size * 0.05],
      keyboard: [0, size * 1.05, size * 0.75],
    };
    goal.current = new THREE.Vector3(...at[view]);
  }, [view, nonce, size]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, Math.min(1, dt * 5));
    controls.current?.target.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 5));
    controls.current?.update();
    if (camera.position.distanceTo(goal.current) < size * 0.01) goal.current = null;
  });
  return null;
}

function Pin({ pin, radius, selected, tag, onSelect }: { pin: LaptopPin; radius: number; selected: boolean; tag?: string; onSelect(): void }) {
  const { position: at, normal } = pin.placement;
  const position: [number, number, number] = [at[0] + normal[0] * radius * 0.6, at[1] + normal[1] * radius * 0.6, at[2] + normal[2] * radius * 0.6];
  const facing = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal)), [normal]);
  const color = PIN_COLOR[pin.defectClass];
  const r = selected ? radius * 1.5 : radius;
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[r, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.25} />
      </mesh>
      {/* 면에 눕힌 고리: 작은 핀도 멀리서 보이게 */}
      <mesh quaternion={facing}>
        <torusGeometry args={[r * 2, r * 0.28, 8, 32]} />
        <meshStandardMaterial color={color} transparent opacity={selected ? 0.95 : 0.6} />
      </mesh>
      {selected && tag && (
        <Html center position={[0, 0, 0]} zIndexRange={[10, 0]} pointerEvents="none" style={{ transform: "translateY(-150%)" }}>
          <span className="whitespace-nowrap rounded-full border bg-white/95 px-2 py-0.5 text-xs font-semibold text-zinc-800 shadow-sm">{tag}</span>
        </Html>
      )}
    </group>
  );
}

export default function LaptopViewer({ dimensions: d, modelCode, color, pins, tags, selected, onSelect, view, viewNonce, lidOpen, onContextLost }: Props) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const size = Math.max(d.widthMm, d.depthMm);
  const body = bodyColor(color);
  const profile = useMemo(() => profileFor(modelCode), [modelCode]);
  const radius = size * 0.0065;
  const basePins = pins.filter((p) => p.placement.part === "base");
  const lidPins = pins.filter((p) => p.placement.part === "lid");
  const shapes = useMemo<FaceShape[]>(
    () => pins.map((p) => ({ id: p.groupId, face: p.face, points: p.shape, color: PIN_COLOR[p.defectClass], emphasis: p.groupId === selected })),
    [pins, selected],
  );
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <Canvas
      camera={{ position: [size * 0.15, size * 0.55, size * 1.3], fov: 38, near: cameraNear(size), far: size * 20 }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[size, size * 2, size]} intensity={1.1} />
      <directionalLight position={[-size, size * 0.6, -size]} intensity={0.35} />
      <group position={[0, -d.depthMm * 0.12, 0]}>
        <LaptopModel
          dimensions={d}
          color={body}
          profile={profile}
          lidOpen={lidOpen}
          shapes={shapes}
          baseChildren={basePins.map((p) => (
            <Pin key={p.groupId} pin={p} radius={radius} selected={selected === p.groupId} tag={tags?.[p.groupId]} onSelect={() => onSelect(p.groupId)} />
          ))}
          lidChildren={lidPins.map((p) => (
            <Pin key={p.groupId} pin={p} radius={radius} selected={selected === p.groupId} tag={tags?.[p.groupId]} onSelect={() => onSelect(p.groupId)} />
          ))}
        />
        <ContactShadows position={[0, -d.baseHMm / 2 - 0.6, 0]} scale={size * 1.35} blur={2.8} opacity={0.32} far={size * 0.25} />
      </group>
      <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={size * 0.55} maxDistance={size * 3.5} />
      <CameraRig view={view} nonce={viewNonce} size={size} controls={controls} />
    </Canvas>
  );
}

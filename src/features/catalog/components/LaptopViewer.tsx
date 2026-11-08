import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import type { ModelDimensions } from "../../../shared/api/types";
import { bodyColor, PIN_COLOR, type LaptopPin } from "../model/laptop3d";

// 노트북 3D 모델 + 흠집 핀(11/8 민서 요청). 기종 치수(mm)로 직접 만든 단순 모델이라 외부 3D 파일·라이선스가 없다.
// 기기 상세에서만 지연 로딩한다(three.js가 크다). 덮개는 경첩에서 돌고, 덮개 쪽 핀은 덮개 그룹 안에 있어 함께 돈다.

export type ViewPreset = "front" | "top" | "bottom" | "keyboard";

const OPEN_DEG = 110;

interface Props {
  dimensions: ModelDimensions;
  color: string | null;
  pins: LaptopPin[];
  selected: string | null;
  onSelect(groupId: string): void;
  view: ViewPreset;
  /** 시점 버튼을 누를 때마다 늘린다(같은 시점을 다시 눌러도 카메라를 그 자리로 되돌리게) */
  viewNonce: number;
  lidOpen: boolean;
}

/** 덮개 각도를 목표값으로 부드럽게 옮긴다(다시 그리지 않고 useFrame에서 회전만 바꾼다) */
function Lid({ open, d, color, children }: { open: boolean; d: ModelDimensions; color: string; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(open ? OPEN_DEG : 0);
  useFrame((_, dt) => {
    const target = open ? OPEN_DEG : 0;
    angle.current += (target - angle.current) * Math.min(1, dt * 6);
    if (group.current) group.current.rotation.x = (-angle.current * Math.PI) / 180;
  });
  return (
    <group ref={group} position={[0, d.baseHMm / 2, -d.depthMm / 2]}>
      <RoundedBox args={[d.widthMm, d.lidHMm, d.depthMm]} radius={Math.min(d.lidHMm / 2, 3)} smoothness={3} position={[0, d.lidHMm / 2, d.depthMm / 2]}>
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.38} />
      </RoundedBox>
      {/* 화면(덮개 안쪽) */}
      <mesh position={[0, -0.05, d.depthMm / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[d.widthMm * 0.94, d.depthMm * 0.9]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.2} metalness={0.1} />
      </mesh>
      {children}
    </group>
  );
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

function Pin({ pin, radius, selected, onSelect }: { pin: LaptopPin; radius: number; selected: boolean; onSelect(): void }) {
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
    </group>
  );
}

export default function LaptopViewer({ dimensions: d, color, pins, selected, onSelect, view, viewNonce, lidOpen }: Props) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const size = Math.max(d.widthMm, d.depthMm);
  const body = bodyColor(color);
  const radius = size * 0.011;
  const halfH = d.baseHMm / 2;
  const basePins = pins.filter((p) => p.placement.part === "base");
  const lidPins = pins.filter((p) => p.placement.part === "lid");
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <Canvas camera={{ position: [size * 0.15, size * 0.55, size * 1.3], fov: 38, near: 1, far: size * 20 }} dpr={[1, 2]}>
      <ambientLight intensity={0.65} />
      <directionalLight position={[size, size * 2, size]} intensity={1.3} />
      <directionalLight position={[-size, -size, -size * 0.5]} intensity={0.45} />
      <group position={[0, -d.depthMm * 0.12, 0]}>
        <RoundedBox args={[d.widthMm, d.baseHMm, d.depthMm]} radius={Math.min(halfH, 3)} smoothness={3}>
          <meshStandardMaterial color={body} metalness={0.55} roughness={0.38} />
        </RoundedBox>
        {/* 키보드 자리와 트랙패드: 윗면에 살짝 띄운 판 */}
        <mesh position={[0, halfH + 0.05, -d.depthMm * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[d.widthMm * 0.84, d.depthMm * 0.42]} />
          <meshStandardMaterial color="#15171c" roughness={0.8} />
        </mesh>
        <mesh position={[0, halfH + 0.05, d.depthMm * 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[d.widthMm * 0.4, d.depthMm * 0.26]} />
          <meshStandardMaterial color={body} metalness={0.3} roughness={0.25} />
        </mesh>
        {basePins.map((p) => (
          <Pin key={p.groupId} pin={p} radius={radius} selected={selected === p.groupId} onSelect={() => onSelect(p.groupId)} />
        ))}
        <Lid open={lidOpen} d={d} color={body}>
          {lidPins.map((p) => (
            <Pin key={p.groupId} pin={p} radius={radius} selected={selected === p.groupId} onSelect={() => onSelect(p.groupId)} />
          ))}
        </Lid>
      </group>
      <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={size * 0.45} maxDistance={size * 3.5} />
      <CameraRig view={view} nonce={viewNonce} size={size} controls={controls} />
    </Canvas>
  );
}

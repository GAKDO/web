import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ModelDimensions } from "../api/types";
import { DefectShapes } from "./DefectShapes";
import type { FaceShape } from "./shapes";

// 등록 기종 노트북 3D 모델(11/8 민서 요청: "실제 기종만큼의 퀄리티"). 외부 3D 파일 없이 기종 치수(mm)로 직접 만든다.
// 둥근 모서리 알루미늄 본체·덮개, 노치가 있는 화면, 실제 배열의 키보드, 트랙패드, 옆면 포트, 바닥 고무발까지 만든다.
// 상표 로고는 넣지 않는다. 좌표는 shared/laptop3d/faces.ts와 같다: 본체 중심이 원점(x 오른쪽, y 위, z 앞),
// 덮개 그룹은 경첩(본체 뒤 윗모서리)이 원점이고 그 안의 덮개는 닫힌 자세(y 0~lidH, z 0~D)다.

/** 기종별 겉모습. 같은 치수라도 화면 노치·모서리 둥글기가 다르다 */
export interface LaptopProfile {
  /** 화면 위 가운데 카메라 노치 */
  notch: boolean;
  /** 본체·덮개 모서리 반지름(mm) */
  cornerMm: number;
  /** 키보드 맨 윗줄(기능 키)이 다른 줄과 같은 높이인지 */
  fullFnRow: boolean;
}

/** 기종 코드 → 겉모습. MacBook Air M2·M3(MBA13-M2 등)는 노치·큰 모서리, 그 밖은 일반 노트북 */
export function profileFor(modelCode: string | null | undefined): LaptopProfile {
  const code = (modelCode ?? "").toUpperCase();
  if (/^MBA\d*-M[2-9]/.test(code) || /^MBP\d*-M/.test(code)) return { notch: true, cornerMm: 11, fullFnRow: true };
  if (code.startsWith("MBA")) return { notch: false, cornerMm: 9, fullFnRow: false };
  return { notch: false, cornerMm: 6, fullFnRow: false };
}

const OPEN_DEG = 110;
/** 화면 판과 덮개 안쪽 면 사이(mm). 눈에 띄지 않을 만큼 얇되 깊이 버퍼가 구분할 만큼은 띄운다 */
const SCREEN_GAP = 0.35;
/** 키보드 바닥판·트랙패드를 본체 윗면에서 띄우는 거리(mm). 같은 이유로 0.03~0.04mm에서 키웠다 */
const SURFACE_GAP = 0.15;

/**
 * 3D 카메라의 가까운 면(near). 1mm로 두면 수백 mm 밖에서 깊이 정밀도가 크게 떨어져 겹친 면이 깨져 보인다.
 * OrbitControls minDistance(큰 변의 0.55배)로 옆에서 가장 가까이 다가가도 옆면까지 약 15mm 남아 잘리지 않는다
 */
export function cameraNear(sizeMm: number): number {
  return Math.max(1, sizeMm * 0.02);
}

/** 둥근 사각형(가운데가 원점) 윤곽 */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/**
 * 판 모양 몸통(본체·덮개): 위에서 본 둥근 사각형을 두께만큼 밀어내고 가장자리를 둥글게 깎는다.
 * 결과는 y 0~thick, 가운데가 x·z 원점
 */
function slabGeometry(w: number, d: number, thick: number, corner: number): THREE.BufferGeometry {
  const bevel = Math.min(1.2, thick * 0.3);
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, d - bevel * 2, Math.max(0.5, corner - bevel)), {
    depth: Math.max(0.01, thick - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 18,
  });
  // 밀어낸 방향(z)을 위(y)로 돌리고, 바닥이 y=0에 오게 옮긴다
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 키 하나: 줄 안 위치(왼쪽부터 키 폭 단위), 폭, 반 높이(위·아래 화살표) */
interface Key {
  row: number;
  x: number;
  w: number;
  half?: "up" | "down";
}

/** 미국식 78키 배열(맨 아래 줄 오른쪽 화살표 묶음 포함). 한 줄 폭은 14.5칸 */
function keyLayout(): Key[] {
  const rows: number[][] = [
    Array(14).fill(14.5 / 14), // 기능 키 줄(esc·F1~F12·지문 버튼)
    [...Array(13).fill(1), 1.5],
    [1.5, ...Array(12).fill(1), 1],
    [1.75, ...Array(11).fill(1), 1.75],
    [2.25, ...Array(10).fill(1), 2.25],
    [1, 1, 1, 1.25, 5, 1.25, 1],
  ];
  const keys: Key[] = [];
  rows.forEach((widths, row) => {
    let x = 0;
    for (const w of widths) {
      keys.push({ row, x, w });
      x += w;
    }
    if (row === 5) {
      // ← (↑/↓ 반 높이) →
      keys.push({ row, x, w: 1 });
      keys.push({ row, x: x + 1, w: 1, half: "up" });
      keys.push({ row, x: x + 1, w: 1, half: "down" });
      keys.push({ row, x: x + 2, w: 1 });
    }
  });
  return keys;
}

const KEYS = keyLayout();

/** 화면(덮개 안쪽) 그림: 얇은 검은 테두리, 어두운 배경 화면, 노치. 실제 화면 내용은 그리지 않는다 */
function screenTexture(w: number, d: number, notch: boolean): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const scale = 4; // 1 mm = 4 px
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(d * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, W, H);
  // 화면(윗쪽 = 덮개 앞 끝). 옆·위 테두리 약 5 mm, 아래(경첩 쪽) 약 9 mm
  const side = 5 * scale;
  const top = 5 * scale;
  const bottom = 9 * scale;
  const g = ctx.createLinearGradient(0, top, W, H - bottom);
  g.addColorStop(0, "#1a2140");
  g.addColorStop(0.55, "#2c2a55");
  g.addColorStop(1, "#5a2d4f");
  ctx.fillStyle = g;
  const r = 4 * scale;
  ctx.beginPath();
  ctx.roundRect(side, top, W - side * 2, H - top - bottom, [r, r, 1.5 * scale, 1.5 * scale]);
  ctx.fill();
  // 화면 위 빛 번짐(유리 느낌)
  const glow = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(side, top, W - side * 2, H - top - bottom);
  if (notch) {
    const nw = 32 * scale;
    const nh = 6 * scale;
    ctx.fillStyle = "#050608";
    ctx.beginPath();
    ctx.roundRect(W / 2 - nw / 2, 0, nw, top + nh, [0, 0, 2.5 * scale, 2.5 * scale]);
    ctx.fill();
    ctx.fillStyle = "#11141c";
    ctx.beginPath();
    ctx.arc(W / 2, top / 2 + nh / 2, 0.9 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 스튜디오 조명 같은 주변 반사(금속 질감). 외부 HDR 파일 없이 three.js의 방 환경으로 만든다 */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const before = scene.environment;
    scene.environment = env;
    return () => {
      scene.environment = before;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface Props {
  dimensions: ModelDimensions;
  /** 몸체 색(#rrggbb) */
  color: string;
  profile: LaptopProfile;
  /** 덮개를 열지. 바뀌면 부드럽게 여닫는다 */
  lidOpen?: boolean;
  /** 실제 탐지된 흠집 모양(면 좌표) */
  shapes?: FaceShape[];
  /** 본체 좌표에 붙일 것(핀 등) */
  baseChildren?: ReactNode;
  /** 덮개 좌표에 붙일 것(덮개와 함께 돈다) */
  lidChildren?: ReactNode;
}

/** 노트북 한 대. 몸통·키·포트의 형상과 재질은 치수·겉모습이 바뀔 때만 다시 만들고, 화면을 닫으면 해제한다 */
export function LaptopModel({ dimensions: d, color, profile, lidOpen = true, shapes = [], baseChildren, lidChildren }: Props) {
  const W = d.widthMm;
  const D = d.depthMm;
  const bh = d.baseHMm;
  const lh = d.lidHMm;

  const parts = useMemo(() => {
    const metal = new THREE.MeshPhysicalMaterial({ color, metalness: 0.88, roughness: 0.34, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 1.1 });
    const dark = new THREE.MeshStandardMaterial({ color: "#0c0d10", roughness: 0.55, metalness: 0.2 });
    const keyMat = new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.62, metalness: 0.05 });
    const pad = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.18, clearcoat: 0.6, envMapIntensity: 0.9 });
    const rubber = new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.9 });
    const base = slabGeometry(W, D, bh, profile.cornerMm);
    base.translate(0, -bh / 2, 0);
    const lid = slabGeometry(W, D, lh, profile.cornerMm);
    lid.translate(0, 0, D / 2);

    // 키보드: 폭은 본체의 약 88%, 뒤쪽 여백 5%, 6줄. 깊이가 모자라면 키 간격을 줄인다
    const kbW = W * 0.885;
    const pitchX = kbW / 14.5;
    const padD = D * 0.37;
    const frontGap = D * 0.035;
    const backGap = D * 0.05;
    const midGap = D * 0.05;
    const pitchZ = Math.min(pitchX, (D - padD - frontGap - backGap - midGap) / 6);
    const gap = pitchX * 0.16;
    const keyH = 0.7;
    const keyGeos = new Map<string, THREE.BufferGeometry>();
    const geoFor = (w: number, h: number) => {
      const k = `${w.toFixed(2)}x${h.toFixed(2)}`;
      let g = keyGeos.get(k);
      if (!g) {
        g = new RoundedBoxGeometry(w, keyH, h, 2, Math.min(1.1, w / 4, h / 4));
        keyGeos.set(k, g);
      }
      return g;
    };
    const kbZ0 = -D / 2 + backGap;
    const keys = KEYS.map((k) => {
      const w = k.w * pitchX - gap;
      const full = pitchZ - gap;
      const h = k.half ? full / 2 - gap / 4 : k.row === 0 && !profile.fullFnRow ? full * 0.6 : full;
      const x = -kbW / 2 + (k.x + k.w / 2) * pitchX;
      let z = kbZ0 + (k.row + 0.5) * pitchZ;
      if (k.half === "up") z -= full / 4 + gap / 8;
      if (k.half === "down") z += full / 4 + gap / 8;
      return { geo: geoFor(w, h), position: [x, bh / 2 + keyH / 2 + 0.2, z] as [number, number, number] };
    });
    const well = new THREE.ShapeGeometry(roundedRect(kbW + gap * 1.6, pitchZ * 6 + gap * 1.6, 2.2));
    well.rotateX(-Math.PI / 2);
    const padW = Math.min(W * 0.42, 135);
    const padGeo = new THREE.ShapeGeometry(roundedRect(padW, padD, 5));
    padGeo.rotateX(-Math.PI / 2);
    const padZ = D / 2 - frontGap - padD / 2;

    const geos = [base, lid, well, padGeo, ...keyGeos.values()];
    const mats = [metal, dark, keyMat, pad, rubber];
    return { metal, dark, keyMat, pad, rubber, base, lid, keys, well, wellZ: kbZ0 + pitchZ * 3, padGeo, padZ, geos, mats };
  }, [W, D, bh, lh, color, profile.cornerMm, profile.fullFnRow]);

  const screen = useMemo(() => screenTexture(W, D, profile.notch), [W, D, profile.notch]);
  useEffect(
    () => () => {
      for (const g of parts.geos) g.dispose();
      for (const m of parts.mats) m.dispose();
    },
    [parts],
  );
  useEffect(() => () => screen?.dispose(), [screen]);

  // 덮개 각도: 목표로 부드럽게(다시 그리지 않고 회전만)
  const lid = useRef<THREE.Group>(null);
  const angle = useRef(lidOpen ? OPEN_DEG : 0);
  useFrame((_, dt) => {
    const target = lidOpen ? OPEN_DEG : 0;
    angle.current += (target - angle.current) * Math.min(1, dt * 6);
    if (lid.current) lid.current.rotation.x = (-angle.current * Math.PI) / 180;
  });

  const portZ = (from: number) => -D / 2 + from;
  return (
    <group>
      <StudioEnvironment />
      {/* 본체 */}
      <mesh geometry={parts.base} material={parts.metal} />
      <mesh geometry={parts.well} material={parts.dark} position={[0, bh / 2 + SURFACE_GAP, parts.wellZ]} />
      {parts.keys.map((k, i) => (
        <mesh key={i} geometry={k.geo} material={parts.keyMat} position={k.position} />
      ))}
      <mesh geometry={parts.padGeo} material={parts.pad} position={[0, bh / 2 + SURFACE_GAP, parts.padZ]} />
      {/* 옆면 포트: 왼쪽 USB-C 2개·충전 단자, 오른쪽 이어폰 단자 */}
      {[
        { z: 16, w: 8.4, h: 2.6 },
        { z: 28, w: 8.4, h: 2.6 },
        { z: 44, w: 12.5, h: 2.9 },
      ].map((p) => (
        <mesh key={p.z} material={parts.dark} position={[-W / 2 - 0.06, 0, portZ(p.z)]} rotation={[0, -Math.PI / 2, 0]}>
          <shapeGeometry args={[roundedRect(p.w, Math.min(p.h, bh * 0.45), Math.min(p.h, bh * 0.45) / 2)]} />
        </mesh>
      ))}
      <mesh material={parts.dark} position={[W / 2 + 0.06, 0, portZ(20)]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[Math.min(1.75, bh * 0.24), 24]} />
      </mesh>
      {/* 바닥 고무발 */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} material={parts.rubber} position={[sx * (W / 2 - 22), -bh / 2 - 0.25, sz * (D / 2 - 20)]}>
          <cylinderGeometry args={[4.5, 4.8, 0.5, 28]} />
        </mesh>
      ))}
      {/* 경첩 */}
      <mesh material={parts.dark} position={[0, bh / 2, -D / 2 + 0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[Math.min(2.2, lh * 0.7), Math.min(2.2, lh * 0.7), W * 0.78, 24]} />
      </mesh>
      <DefectShapes part="base" dimensions={d} shapes={shapes} />
      {baseChildren}
      {/* 덮개: 경첩에서 돈다 */}
      <group ref={lid} position={[0, bh / 2, -D / 2]}>
        <mesh geometry={parts.lid} material={parts.metal} />
        {/* 화면 판은 덮개 안쪽 면에서 SCREEN_GAP만큼 띄우고 polygonOffset으로 한 번 더 앞으로 당긴다.
            예전처럼 0.04mm만 띄우면 멀리서(확대를 줄였을 때) 깊이 버퍼 정밀도보다 간격이 작아져
            덮개 금속면과 화면이 번갈아 그려지는 줄무늬(z-fighting)가 생겼다(11/11 민서 스크린샷) */}
        <mesh position={[0, -SCREEN_GAP, D / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[W - 1.6, D - 1.6]} />
          <meshStandardMaterial map={screen ?? undefined} color={screen ? "#ffffff" : "#0b0d12"} emissiveMap={screen ?? undefined} emissive="#ffffff" emissiveIntensity={0.3} roughness={0.5} metalness={0} envMapIntensity={0.04} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-4} />
        </mesh>
        <DefectShapes part="lid" dimensions={d} shapes={shapes} />
        {lidChildren}
      </group>
    </group>
  );
}

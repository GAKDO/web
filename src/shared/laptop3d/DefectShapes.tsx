import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CaptureFace, ModelDimensions } from "../api/types";
import { faceAspect, facePlanes, paintFace, type FacePlane, type FaceShape } from "./shapes";

// 흠집 모양 겹쳐 그리기(11/8). 흠집이 있는 면마다 투명 그림판(CanvasTexture)에 실제 폴리곤을 그리고,
// 그 면 위에 살짝 띄운 판에 입힌다. 옆면은 본체·덮개 두 판이 같은 그림을 나눠 쓴다(판마다 uv 범위만 다르다).

/**
 * 면 위로 띄우는 거리(mm). 키보드 면은 키 위로 올라와야 보인다.
 * 화면 면(SCR0·SCR1)은 화면 판이 덮개 안쪽 면에서 0.35mm(LaptopModel SCREEN_GAP) 떠 있으므로 그보다 앞에 둔다
 */
const LIFT: Partial<Record<CaptureFace, number>> = { KB: 0.9, SCR0: 0.5, SCR1: 0.5 };
const TEX_LONG = 1536;

interface FaceLayer {
  face: CaptureFace;
  texture: THREE.CanvasTexture;
  planes: FacePlane[];
}

/** 판 하나의 위치·방향(그 부분 좌표). x축 = u 방향, y축 = 그림 위쪽, z축 = 두 축의 외적 */
function planeTransform(plane: FacePlane, lift: number): { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 } {
  const u = new THREE.Vector3(...plane.uAxis);
  const up = new THREE.Vector3(...plane.upAxis);
  const z = new THREE.Vector3().crossVectors(u, up).normalize();
  const m = new THREE.Matrix4().makeBasis(u.clone().normalize(), up.clone().normalize(), z);
  const n = new THREE.Vector3(...plane.normal);
  return {
    position: new THREE.Vector3(...plane.center).addScaledVector(n, lift),
    quaternion: new THREE.Quaternion().setFromRotationMatrix(m),
    scale: new THREE.Vector3(u.length(), up.length(), 1),
  };
}

/** 판의 uv를 그 판이 덮는 v 범위로 좁힌 평면 형상(그림 위쪽 = v0) */
function planeGeometry(plane: FacePlane): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    // 평면 uv y=1(위)이 v0, y=0(아래)이 v1. 그림판은 flipY라 텍스처 y = 1 − v
    uv.setY(i, 1 - plane.v1 + uv.getY(i) * (plane.v1 - plane.v0));
  }
  uv.needsUpdate = true;
  return geo;
}

export function DefectShapes({ part, dimensions: d, shapes }: { part: "base" | "lid"; dimensions: ModelDimensions; shapes: FaceShape[] }) {
  const layers = useMemo<FaceLayer[]>(() => {
    if (typeof document === "undefined" || shapes.length === 0) return [];
    const byFace = new Map<CaptureFace, FaceShape[]>();
    for (const s of shapes) byFace.set(s.face, [...(byFace.get(s.face) ?? []), s]);
    const out: FaceLayer[] = [];
    for (const [face, list] of byFace) {
      const planes = facePlanes(face, d).filter((p) => p.part === part);
      if (planes.length === 0) continue;
      const aspect = faceAspect(face, d);
      const canvas = document.createElement("canvas");
      canvas.width = aspect >= 1 ? TEX_LONG : Math.max(64, Math.round(TEX_LONG * aspect));
      canvas.height = aspect >= 1 ? Math.max(64, Math.round(TEX_LONG / aspect)) : TEX_LONG;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      paintFace(ctx, canvas.width, canvas.height, list);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      out.push({ face, texture, planes });
    }
    return out;
  }, [part, d, shapes]);

  const meshes = useMemo(
    () =>
      layers.flatMap((layer) =>
        layer.planes.map((plane, i) => ({
          key: `${layer.face}-${i}`,
          texture: layer.texture,
          geometry: planeGeometry(plane),
          ...planeTransform(plane, LIFT[layer.face] ?? 0.12),
        })),
      ),
    [layers],
  );
  useEffect(
    () => () => {
      for (const l of layers) l.texture.dispose();
      for (const m of meshes) m.geometry.dispose();
    },
    [layers, meshes],
  );

  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} position={m.position} quaternion={m.quaternion} scale={m.scale} renderOrder={2}>
          <meshBasicMaterial map={m.texture} transparent depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

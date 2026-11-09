"use client";

import * as React from "react";
import * as THREE from "three";
import type { BufferGeometry, Material, Mesh, Object3D } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  createMouseDisplaceMaterial,
  FAR_POINT,
  MouseDisplaceUniforms,
} from "./createMouseDisplaceMaterial";
import { useFitToViewport } from "./useFitToViewport";
import { useBackgroundEffects } from "./BackgroundEffectsProvider";
import type { EffectEvent, InferencePulseMode, InferencePulseState } from "./BackgroundEffectsProvider";
import { useEffectBus } from "./useEffectBus";
import { tap } from "../../lib/haptics";

type GLTF = {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  parser?: any;
};

const baseMaterial = new THREE.MeshStandardMaterial({
  color: "#14141c",
  metalness: 0.15,
  roughness: 0.80,
  emissive: "#050508",
  emissiveIntensity: 0.9,
});

function pulseColorFor(uniforms: MouseDisplaceUniforms, mode: InferencePulseMode) {
  if (mode === "system") return uniforms.uPulseColorSystem.value;
  if (mode === "neutral") return uniforms.uPulseColorNeutral.value;
  return uniforms.uPulseColorAi.value;
}

function pulseEnvelope(progress01: number) {
  const t = Math.min(Math.max(progress01, 0), 1);
  const attack = Math.min(t / 0.18, 1);
  const decayT = Math.max((t - 0.18) / 0.82, 0);
  const decay = 1 - decayT * decayT;
  return attack * decay;
}

type InteractiveModelProps = {
  radius?: number;
  strength?: number;
  opacity?: number;
  idleStrength?: number;
  modelScale?: number;
  modelUrl?: string | null;
  reducedMotion?: boolean;
  touchOnly?: boolean;
  hasPointer?: boolean;
  debug?: boolean;

  inferencePulse?: InferencePulseState | null;
};

function useOverlayMaterial(options: {
  radius: number;
  strength: number;
  opacity: number;
  idleStrength: number;
}) {
  const material = React.useMemo(() => createMouseDisplaceMaterial(options), [options]);

  React.useEffect(() => {
    material.wireframe = true;
    material.transparent = true;
    material.depthWrite = false;
    return () => material.dispose();
  }, [material]);

  return material;
}

type MeshWithGeom = Mesh<BufferGeometry, Material | Material[]>;

function isMeshWithBufferGeometry(obj: Object3D): obj is MeshWithGeom {
  const anyObj = obj as unknown as { isMesh?: boolean; geometry?: { isBufferGeometry?: boolean } };
  return anyObj.isMesh === true && anyObj.geometry?.isBufferGeometry === true;
}

function GlbLayer({
  url,
  material,
  onReady,
}: {
  url: string;
  material: Material;
  onReady?: () => void;
}) {
  const gltf = useGLTF(url) as unknown as GLTF;

  const scene = React.useMemo<THREE.Group>(() => gltf.scene.clone(true) as THREE.Group, [gltf.scene]);

  React.useEffect(() => {
    scene.traverse((obj) => {
      if (!isMeshWithBufferGeometry(obj)) return;
      obj.material = material;
    });

    onReady?.();

    scene.updateWorldMatrix(true, true);
  }, [scene, material, onReady]);

  return <primitive object={scene} />;
}

export function InteractiveModel({
  radius = 0.65,
  strength = 0.4,
  opacity = 0.45,
  idleStrength = 0.02,
  modelScale = 1,
  modelUrl,
  reducedMotion = false,
  touchOnly = false,
  hasPointer = true,
  debug = false,
  inferencePulse = null,
}: InteractiveModelProps) {
  const { triggerInferencePulse } = useBackgroundEffects();

  // Effect bus: every pulse also arrives here as an event. Pulse rendering still
  // follows the `inferencePulse` prop; the bus is the attachment point for
  // later phases (scene interface, console, dice), so for now we only keep the
  // most recent event.
  const lastEffectRef = React.useRef<EffectEvent | null>(null);
  useEffectBus((event) => {
    lastEffectRef.current = event;
  });

  const baseRef = React.useRef<THREE.Group | null>(null);
  const overlayRef = React.useRef<THREE.Group | null>(null);
  const debugRef = React.useRef<THREE.Mesh | null>(null);

  const { rootRef, contentRef, fitScale, refit } = useFitToViewport({
    marginY: 0.1,
    marginX: 0.1,
    fit: "both",
  });

  const overlayOptions = React.useMemo(
    () => ({ radius, strength, opacity, idleStrength }),
    [radius, strength, opacity, idleStrength]
  );

  const overlayMaterial = useOverlayMaterial(overlayOptions);
  const { raycaster, pointer, camera } = useThree();
  const tempPoint = React.useMemo(() => new THREE.Vector3(), []);

  React.useEffect(() => {
    const uniforms = overlayMaterial.uniforms as MouseDisplaceUniforms;
    uniforms.uRadius.value = radius;
    uniforms.uOpacity.value = opacity;
  }, [overlayMaterial, radius, opacity]);

  // Click -> pulse on the wireframe overlay (manual raycast).
React.useEffect(() => {
  const onPointerDown = (ev: PointerEvent) => {
    if (reducedMotion) return;

    const el = ev.target as HTMLElement | null;
    // Ignore clicks on actual interactive elements only
    if (el?.closest('a,button,input,textarea,select,option,[role="button"],[data-click-block]')) {
      return;
    }

    tap();
    triggerInferencePulse({ intensity: 0.95, durationMs: 900, mode: "ai" });
  };

  window.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
  return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true } as any);
}, [triggerInferencePulse, reducedMotion]);

  useFrame((_, delta) => {
    const uniforms = overlayMaterial.uniforms as MouseDisplaceUniforms;
    const disableMotion = reducedMotion || touchOnly;

    // Drive the pulse on the wireframe overlay; the color follows the pulse mode.
    // Written before the motion gate so taps and idle pulses render on touch
    // devices, where hover displacement and idle wobble stay off.
    let p = 0;
    if (inferencePulse) {
      const now = performance.now();
      const elapsed = now - inferencePulse.startTime;
      if (elapsed >= 0 && elapsed <= inferencePulse.durationMs) {
        p = pulseEnvelope(elapsed / inferencePulse.durationMs) * inferencePulse.intensity;
      }
      uniforms.uPulseColor.value.copy(pulseColorFor(uniforms, inferencePulse.mode));
    }
    uniforms.uPulse.value = p;

    if (disableMotion) {
      uniforms.uStrength.value = 0;
      uniforms.uIdleStrength.value = 0;
      uniforms.uMouse.value.copy(FAR_POINT);
      return;
    }

    uniforms.uTime.value += delta;

    uniforms.uStrength.value = strength;
    uniforms.uIdleStrength.value = idleStrength;

    if (!baseRef.current || !overlayRef.current || !hasPointer) {
      uniforms.uMouse.value.copy(FAR_POINT);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(baseRef.current, true);

    if (hits.length > 0) {
      tempPoint.copy(hits[0].point);
      overlayRef.current.worldToLocal(tempPoint);
      uniforms.uMouse.value.copy(tempPoint);
      if (debugRef.current) debugRef.current.position.copy(tempPoint);
    } else {
      uniforms.uMouse.value.copy(FAR_POINT);
    }
  });

  // No fallback geometry: avoid showing a "backup" model while the GLB loads.
  if (!modelUrl) return null;

  return (
    <group ref={rootRef} scale={fitScale * modelScale}>
      <group ref={contentRef}>
        <group ref={baseRef}>
          <GlbLayer url={modelUrl} material={baseMaterial} onReady={refit} />
        </group>

        <group ref={overlayRef}>
          <GlbLayer url={modelUrl} material={overlayMaterial} />
        </group>

        {debug ? (
          <mesh ref={debugRef} visible={debug}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#ff9f1a" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

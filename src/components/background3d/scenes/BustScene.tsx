"use client";

import * as React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { InteractiveModel } from "../InteractiveModel";
import { BackgroundErrorBoundary } from "../BackgroundErrorBoundary";
import type { SceneProps } from "../scene";
import type { EffectBus } from "../BackgroundEffectsProvider";
import { TELEMETRY_EMA_ALPHA, telemetry } from "../../devconsole/telemetry";

// Content-hashed file name: /models/* is served immutable (public/_headers), so
// a new export must get a new hash (sha256, first 8 hex) and a new name here.
const MODEL_PATH = "/models/hero.81d5ae4d.glb";

// Pulse tuning
const INTRO_PULSE_DELAY_MS = 650;
const INTRO_PULSE = { intensity: 0.55, durationMs: 850, mode: "system" as const };

const IDLE_PULSE = { intensity: 0.55, durationMs: 1200, mode: "system" as const };
const IDLE_PULSE_INTERVAL_MS = { base: 5000, jitter: 2500 };

// Grid reactivity
const GRID_Z = -1.55;
const GRID_REACT = 0.9;

// Dice effects on the grid (natural 20 wave, natural 1 glitch), see diceEffects.ts.
const WAVE_SECONDS = 1.4;
const WAVE_SPEED = 3.0;
const WAVE_WIDTH = 0.35;
const WAVE_COLOR = "#d4af5a";
const GLITCH_SECONDS = 0.9;
const GLITCH_MAX_OFFSET = 0.06;

type PointGridProps = {
  /** Plane Z in world units. Should be behind the bust (further from camera). */
  z?: number;
  /** Approximate spacing between points in world units. */
  spacing?: number;
  /** Base point size (pixels, attenuated by distance). */
  pointSize?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  reactStrength?: number;
  /** Cursor position in the grid plane's local XY; drives the bulge and brighten. */
  mouse?: THREE.Vector2;
  /** Effect bus: "dice" naturals start the wave and glitch. */
  effects?: EffectBus;
  /** No wave or jitter under reduced motion. */
  reducedMotion?: boolean;
};

function PointGrid({
  z = -1.55,
  spacing = 0.17,
  pointSize = 2.25,
  color = "#a9a8b2",
  opacity = 0.45,
  reactStrength = 1.0,
  mouse,
  effects,
  reducedMotion = false,
}: PointGridProps) {
  const { camera, size } = useThree();
  const materialRef = React.useRef<THREE.ShaderMaterial | null>(null);

  // Dice naturals: subscribe once, keep the trigger times in refs, read them in useFrame.
  const waveStart = React.useRef(-1);
  const glitchStart = React.useRef(-1);
  const reducedMotionRef = React.useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  React.useEffect(() => {
    if (!effects) return;
    return effects.subscribeEffect((event) => {
      if (event.type !== "dice" || reducedMotionRef.current) return;
      if (event.outcome === "nat20") waveStart.current = performance.now();
      if (event.outcome === "nat1") glitchStart.current = performance.now();
    });
  }, [effects]);

  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();

    // Fit the grid to the camera frustum at the chosen plane depth.
    const aspect = size.height > 0 ? size.width / size.height : 1;

    let frustumWidth = 6;
    let frustumHeight = 4;

    // Prefer a perspective camera if available (standard for this scene).
    const anyCam = camera as unknown as { isPerspectiveCamera?: boolean; fov?: number };
    if (anyCam?.isPerspectiveCamera && typeof anyCam.fov === "number") {
      const fovRad = THREE.MathUtils.degToRad(anyCam.fov);
      const camZ = (camera.position?.z ?? 0) as number;
      const dist = Math.max(0.001, Math.abs(camZ - z));
      frustumHeight = 2 * Math.tan(fovRad * 0.5) * dist;
      frustumWidth = frustumHeight * aspect;
    }

    // Slight overscan so points extend past the viewport edges.
    const overscan = 1.12;
    frustumWidth *= overscan;
    frustumHeight *= overscan;

    const cols = Math.max(2, Math.floor(frustumWidth / spacing) + 1);
    const rows = Math.max(2, Math.floor(frustumHeight / spacing) + 1);

    const positions = new Float32Array(cols * rows * 3);

    let o = 0;
    for (let iy = 0; iy < rows; iy += 1) {
      const ty = rows <= 1 ? 0.5 : iy / (rows - 1);
      const y = (ty - 0.5) * frustumHeight;
      for (let ix = 0; ix < cols; ix += 1) {
        const tx = cols <= 1 ? 0.5 : ix / (cols - 1);
        const x = (tx - 0.5) * frustumWidth;

        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
        o += 3;
      }
    }

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.computeBoundingSphere();
    return g;
  }, [camera, size.width, size.height, spacing, z]);

  React.useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const material = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uPointSize: { value: pointSize },

        // Reactive motion: time drives the shimmer, strength and mouse drive the bulge.
        uTime: { value: 0 },
        uReactStrength: { value: reactStrength },
        uMouse: { value: mouse ? mouse.clone() : new THREE.Vector2(999, 999) },

        // Natural 20: a ring expanding from the bust; natural 1: hashed jitter.
        uWaveTime: { value: -1 },
        uWaveOrigin: { value: new THREE.Vector2(0, 0) },
        uWaveSpeed: { value: WAVE_SPEED },
        uWaveWidth: { value: WAVE_WIDTH },
        uWaveColor: { value: new THREE.Color(WAVE_COLOR) },
        uGlitch: { value: 0 },
      },
vertexShader: /* glsl */ `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uReactStrength;
  uniform vec2 uMouse;
  uniform float uWaveTime;
  uniform vec2 uWaveOrigin;
  uniform float uWaveSpeed;
  uniform float uWaveWidth;
  uniform float uGlitch;

  varying float vFalloff;
  varying float vWave;

  float sat(float x) { return clamp(x, 0.0, 1.0); }
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 pos = position;

    // Natural 1: jitter by a hash of position and the 30 Hz frame bucket, at most 0.06 units.
    if (uGlitch > 0.0) {
      vec2 seed = pos.xy + floor(uTime * 30.0);
      pos.x += (hash21(seed) - 0.5) * 2.0 * ${GLITCH_MAX_OFFSET} * uGlitch;
      pos.y += (hash21(seed + 7.3) - 0.5) * 2.0 * ${GLITCH_MAX_OFFSET} * uGlitch;
    }

    // Natural 20: ring weight w(d, t) = exp(-((d - v t) / sigma)^2) * (1 - smoothstep(0.6, 1.4, t)).
    float w = 0.0;
    if (uWaveTime >= 0.0) {
      float d = distance(pos.xy, uWaveOrigin);
      float ring = (d - uWaveSpeed * uWaveTime) / uWaveWidth;
      w = exp(-ring * ring) * (1.0 - smoothstep(0.6, 1.4, uWaveTime));
    }
    vWave = w;
    pos.z += 0.18 * w;

    float d = distance(pos.xy, uMouse);
    float falloff = exp(-d * d * 2.2);
    vFalloff = sat(falloff);

    float bulge = vFalloff * uReactStrength;

    // Curvature toward camera near cursor
    pos.z += bulge * 0.22;

    // Slight XY pull to enhance bend illusion
    vec2 toMouse = (uMouse - pos.xy);
    pos.xy += toMouse * (0.045 * bulge);

    // Micro shimmer only when reactive
    float shimmer = sin(uTime * 1.2 + pos.x * 1.4 + pos.y * 1.4) * 0.01;
    pos.z += shimmer * bulge;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float atten = 220.0 / max(1.0, -mv.z);
    gl_PointSize = clamp(uPointSize * atten, 1.0, 4.0);
  }
`,

      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform vec3 uWaveColor;
        varying float vFalloff;
        varying float vWave;

        float sat(float x) { return clamp(x, 0.0, 1.0); }

        void main() {
          // Circular point sprite.
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p);

          // Soft edge.
          float a = 1.0 - smoothstep(0.38, 0.5, r);

          // Brighten up to 25% near the cursor; the wave tints gold and lifts alpha.
          float alpha = uOpacity * a * mix(1.0, 1.25, vFalloff) * (1.0 + 1.5 * vWave);
          gl_FragColor = vec4(mix(uColor, uWaveColor, vWave), sat(alpha));
        }
      `,
    });
  }, [color, opacity, pointSize, reactStrength, mouse]);

  React.useEffect(() => {
    materialRef.current = material;
    return () => material.dispose();
  }, [material]);

  React.useEffect(() => {
    material.uniforms.uReactStrength.value = reactStrength;
  }, [material, reactStrength]);

  React.useEffect(() => {
    material.uniforms.uMouse.value = mouse ? mouse.clone() : new THREE.Vector2(999, 999);
  }, [material, mouse]);

useFrame((_, delta) => {
  const m = materialRef.current;
  if (!m) return;

  m.uniforms.uTime.value += delta;
  m.uniforms.uReactStrength.value = reactStrength;

  const now = performance.now();
  const waveT = waveStart.current < 0 ? -1 : (now - waveStart.current) / 1000;
  if (waveT > WAVE_SECONDS) waveStart.current = -1;
  m.uniforms.uWaveTime.value = waveT > WAVE_SECONDS ? -1 : waveT;
  const glitchT = glitchStart.current < 0 ? -1 : (now - glitchStart.current) / 1000;
  if (glitchT > GLITCH_SECONDS) glitchStart.current = -1;
  m.uniforms.uGlitch.value = glitchT < 0 || glitchT > GLITCH_SECONDS ? 0 : 1 - glitchT / GLITCH_SECONDS;

  if (mouse) m.uniforms.uMouse.value.copy(mouse);
  else m.uniforms.uMouse.value.set(999, 999);
});

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}

function GridMouseTracker({
  planeZ,
  mouse,
  enabled,
  smoothing = 0.18,
}: {
  planeZ: number;
  mouse: THREE.Vector2;
  enabled: boolean;
  smoothing?: number;
}) {
  const { raycaster, pointer, camera } = useThree();
  const plane = React.useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ),
    [planeZ]
  );
  const hit = React.useMemo(() => new THREE.Vector3(), []);
  const target = React.useMemo(() => new THREE.Vector2(999, 999), []);

  useFrame(() => {
    if (!enabled) {
      mouse.set(999, 999);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const res = raycaster.ray.intersectPlane(plane, hit);
    if (!res) {
      mouse.set(999, 999);
      return;
    }

    target.set(hit.x, hit.y);
    mouse.lerp(target, smoothing);
  });

  return null;
}

/**
 * Writes renderer stats into the shared telemetry object each frame, for the
 * console and HUD outside the Canvas. Default useFrame priority, so R3F keeps
 * rendering. gl.info resets at the start of each render and useFrame runs
 * before it, so the counts describe the previous frame.
 */
function TelemetryProbe() {
  const frameloop = useThree((state) => state.frameloop);
  const emaMs = React.useRef(0);

  React.useEffect(() => {
    // Under reduced motion the frameloop is "demand": no steady frames, so
    // readers show "demand mode" instead of a stale FPS.
    telemetry.frameloop = frameloop === "demand" ? "demand" : "always";
    return () => {
      telemetry.fps = 0;
      telemetry.frameMs = 0;
    };
  }, [frameloop]);

  useFrame((state, delta) => {
    if (!telemetry.enabled) return;
    const ms = delta * 1000;
    emaMs.current = emaMs.current === 0 ? ms : emaMs.current + TELEMETRY_EMA_ALPHA * (ms - emaMs.current);
    telemetry.frameMs = emaMs.current;
    telemetry.fps = emaMs.current > 0 ? 1000 / emaMs.current : 0;

    const { render, memory } = state.gl.info;
    telemetry.drawCalls = render.calls;
    telemetry.triangles = render.triangles;
    telemetry.points = render.points;
    telemetry.lines = render.lines;
    telemetry.geometries = memory.geometries;
    telemetry.textures = memory.textures;
    telemetry.dpr = state.viewport.dpr;
    telemetry.width = state.size.width;
    telemetry.height = state.size.height;
  });

  return null;
}

/**
 * The bust and point grid: what BackgroundCanvas rendered inline before the
 * scene interface. Receives the effect bus as a prop and emits its own intro
 * and idle pulses on it.
 */
export default function BustScene({ effects, reducedMotion, coarsePointer }: SceneProps) {
  const [debug, setDebug] = React.useState(false);
  const [hasPointer, setHasPointer] = React.useState(false);

  const isDev = process.env.NODE_ENV !== "production";
  const gridMouse = React.useMemo(() => new THREE.Vector2(999, 999), []);
  const gridReactiveEnabled = !reducedMotion && !coarsePointer && hasPointer;

  React.useEffect(() => {
    const onPointer = () => setHasPointer(true);
    window.addEventListener("pointermove", onPointer, { once: true });
    window.addEventListener("pointerdown", onPointer, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(isDev && params.has("debug3d"));
  }, [isDev]);

  // Kick a single pulse shortly after mount so the effect is immediately discoverable.
  React.useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => {
      effects.emitEffect({ type: "pulse", options: INTRO_PULSE });
    }, INTRO_PULSE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [reducedMotion, effects]);

  // Periodic idle pulses (tuned frequency + strength).
  React.useEffect(() => {
    if (reducedMotion) return;

    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        effects.emitEffect({ type: "pulse", options: IDLE_PULSE });
        schedule();
      }, IDLE_PULSE_INTERVAL_MS.base + Math.random() * IDLE_PULSE_INTERVAL_MS.jitter);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [reducedMotion, effects]);

  return (
    <>
      <TelemetryProbe />
      <GridMouseTracker
        planeZ={GRID_Z}
        mouse={gridMouse}
        enabled={gridReactiveEnabled}
      />
      <PointGrid
        z={GRID_Z}
        mouse={gridMouse}
        reactStrength={gridReactiveEnabled ? GRID_REACT : 0}
        effects={effects}
        reducedMotion={reducedMotion}
      />
      <ambientLight intensity={0.25} />
      <hemisphereLight
        intensity={0.55}
        color={new THREE.Color("#c9d4f0")}
        groundColor={new THREE.Color("#0a0a0d")}
      />
      <directionalLight position={[2.8, 2.6, 2.2]} intensity={1.55} color="#fff4dc" />
      <directionalLight position={[-2.2, -1.4, -1.8]} intensity={0.55} />
      <directionalLight position={[0.0, 2.2, -2.4]} intensity={0.35} />

      {/* A failed model fetch should leave the point grid up, not blank the page. */}
      <BackgroundErrorBoundary label="hero model">
        <InteractiveModel
          modelUrl={MODEL_PATH}
          modelScale={1}
          effects={effects}
          reducedMotion={reducedMotion}
          touchOnly={coarsePointer}
          hasPointer={hasPointer}
          debug={debug}
          radius={.4}
          strength={0.9}
          opacity={0.95}
          idleStrength={0.05}
        />
      </BackgroundErrorBoundary>
    </>
  );
}

"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useBackgroundEffects } from "./BackgroundEffectsProvider";
import type { SceneProps } from "./scene";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useTouchOnly() {
  const [touchOnly, setTouchOnly] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchOnly(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return touchOnly;
}

/**
 * Reports the first frame the renderer actually draws. onCreated fires before
 * any frame exists, so a fade keyed on it runs over an empty canvas and the
 * scene still pops in one step when the first frame lands (traced in
 * docs/phase-3/REVIEW.md). useFrame runs before this frame's gl.render, so
 * the signal is deferred one tick to be sure the pixels are on screen.
 */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const fired = React.useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    requestAnimationFrame(onFirstFrame);
  });
  return null;
}

// If no frame is ever reported (nothing invalidates a demand frameloop), show
// the canvas anyway rather than leaving the background blank for good.
const FIRST_FRAME_FALLBACK_MS = 3000;
const SCENE_FADE_MS = 400;

type BackgroundCanvasProps = {
  /** Scene module rendered inside the Canvas; see scene.ts. */
  scene: React.ComponentType<SceneProps>;
};

export function BackgroundCanvas({ scene: Scene }: BackgroundCanvasProps) {
  const { emitEffect, subscribeEffect } = useBackgroundEffects();
  const effects = React.useMemo(
    () => ({ emitEffect, subscribeEffect }),
    [emitEffect, subscribeEffect]
  );

  const [eventSource, setEventSource] = React.useState<HTMLElement | null>(null);

  // The canvas mounts at opacity 0 and fades in once the first frame is drawn.
  const [sceneVisible, setSceneVisible] = React.useState(false);
  const showScene = React.useCallback(() => setSceneVisible(true), []);

  React.useEffect(() => {
    const t = window.setTimeout(showScene, FIRST_FRAME_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [showScene]);

  const reducedMotion = usePrefersReducedMotion();
  const touchOnly = useTouchOnly();

  React.useEffect(() => setEventSource(document.body), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          opacity: sceneVisible ? 1 : 0,
          transition: `opacity ${SCENE_FADE_MS}ms ease-out`,
        }}
      >
        <Canvas
          style={{
            background: "transparent",
            width: "100%",
            height: "100%",
            display: "block",
          }}
          camera={{ position: [0, 0.5, 3.6], fov: 55 }}
          dpr={[1, 2]}
          eventSource={eventSource ?? undefined}
          eventPrefix="client"
          frameloop={reducedMotion ? "demand" : "always"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#000000"), 0);
          }}
        >
          <FirstFrame onFirstFrame={showScene} />
          <Scene effects={effects} reducedMotion={reducedMotion} coarsePointer={touchOnly} />
        </Canvas>
      </div>
    </div>
  );
}

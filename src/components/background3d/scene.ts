import type * as React from "react";
import type { EffectBus } from "./BackgroundEffectsProvider";

/**
 * Contract between BackgroundCanvas and a scene module. A scene is a plain
 * React component rendered inside the R3F Canvas; everything it needs from
 * the page arrives as props, so a future WebGPU or WASM scene is just another
 * module behind the same interface.
 */
export interface SceneHandle {
  dispose(): void;
}

export interface SceneProps {
  /** Effect bus from BackgroundEffectsProvider; the scene never reads context. */
  effects: EffectBus;
  reducedMotion: boolean;
  coarsePointer: boolean;
}

export type SceneModule = { default: React.ComponentType<SceneProps> };

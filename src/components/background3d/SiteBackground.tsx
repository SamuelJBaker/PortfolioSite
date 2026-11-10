"use client";

import dynamic from "next/dynamic";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { BackgroundErrorBoundary } from "./BackgroundErrorBoundary";

// The scene is its own chunk: the canvas shell mounts first, the bust and grid
// code arrives behind it.
const BustScene = dynamic(() => import("./scenes/BustScene"), { ssr: false });

/** The public site's background: the canvas with the bust scene. Decorative only; if it fails, drop it and keep the page. */
export function SiteBackground() {
  return (
    <BackgroundErrorBoundary label="background canvas">
      <BackgroundCanvas scene={BustScene} />
    </BackgroundErrorBoundary>
  );
}

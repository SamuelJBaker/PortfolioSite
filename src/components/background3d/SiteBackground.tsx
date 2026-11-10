"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { BackgroundErrorBoundary } from "./BackgroundErrorBoundary";

// Both halves are their own chunks, so the page hydrates without three.js:
// the canvas shell (fiber + three) first, the bust and grid behind it.
const BackgroundCanvas = dynamic(
  () => import("./BackgroundCanvas").then((m) => m.BackgroundCanvas),
  { ssr: false }
);
const BustScene = dynamic(() => import("./scenes/BustScene"), { ssr: false });

// On coarse pointers the scene waits for an idle moment after first paint.
const COARSE_POINTER_DEFER_MS = 1500;

function useMountAfterPaint() {
  const [mount, setMount] = React.useState(false);

  React.useEffect(() => {
    const show = () => {
      // Fetch the scene chunk alongside the canvas chunk instead of after the
      // WebGL context exists; webpack dedupes it when BustScene renders.
      void import("./scenes/BustScene");
      setMount(true);
    };
    if (!window.matchMedia("(pointer: coarse)").matches) {
      show();
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(show, { timeout: COARSE_POINTER_DEFER_MS });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(show, COARSE_POINTER_DEFER_MS);
    return () => window.clearTimeout(t);
  }, []);

  return mount;
}

/** The public site's background: the canvas with the bust scene. Decorative only; if it fails, drop it and keep the page. */
export function SiteBackground() {
  const mount = useMountAfterPaint();
  if (!mount) return null;

  return (
    <BackgroundErrorBoundary label="background canvas">
      <BackgroundCanvas scene={BustScene} />
    </BackgroundErrorBoundary>
  );
}

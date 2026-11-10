"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useBackgroundEffects } from "../background3d/BackgroundEffectsProvider";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import { setConsoleOpener } from "./opener";

// The panel, HUD, registry and commands are one lazy chunk, fetched on first open.
const DevConsole = dynamic(() => import("./DevConsole"), { ssr: false });

const TAP_COUNT = 5;
const TAP_WINDOW_MS = 2000;

/**
 * Always-loaded part of the engine console: the backtick toggle, Escape,
 * five taps on the SJB mark, the ?console query and window.sjb.open() (via
 * opener.ts). Renders nothing until the console is first opened.
 */
export function ConsoleTrigger() {
  const [loaded, setLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [focusToken, setFocusToken] = React.useState(0);
  const openRef = React.useRef(false);
  openRef.current = open;

  const { emitEffect, subscribeEffect } = useBackgroundEffects();
  const effects = React.useMemo(() => ({ emitEffect, subscribeEffect }), [emitEffect, subscribeEffect]);
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  const openConsole = React.useCallback(() => {
    setLoaded(true);
    setOpen(true);
    setFocusToken((t) => t + 1);
  }, []);
  const closeConsole = React.useCallback(() => setOpen(false), []);

  const navigate = React.useCallback(
    (href: string) => {
      if (/^https?:/i.test(href) || href.endsWith(".pdf")) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      if (href.startsWith("mailto:")) {
        window.location.assign(href);
        return;
      }
      router.push(href);
    },
    [router]
  );

  React.useEffect(() => {
    setConsoleOpener(openConsole);
    return () => setConsoleOpener(null);
  }, [openConsole]);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).has("console")) openConsole();
  }, [openConsole]);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (openRef.current) closeConsole();
        return;
      }
      if (ev.code !== "Backquote" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const target = ev.target instanceof Element ? ev.target : null;
      const consoleInput = target?.closest<HTMLInputElement>("[data-console-input]");
      if (consoleInput) {
        // The toggle key on an empty console input closes; otherwise it types.
        if (consoleInput.value === "") {
          ev.preventDefault();
          closeConsole();
        }
        return;
      }
      if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      ev.preventDefault();
      if (openRef.current) closeConsole();
      else openConsole();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openConsole, closeConsole]);

  React.useEffect(() => {
    let taps: number[] = [];
    const onClick = (ev: MouseEvent) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target?.closest("[data-console-mark]")) return;
      const now = performance.now();
      taps = taps.filter((t) => now - t < TAP_WINDOW_MS);
      taps.push(now);
      if (taps.length >= TAP_COUNT) {
        taps = [];
        ev.preventDefault();
        openConsole();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [openConsole]);

  if (!loaded) return null;

  return (
    <DevConsole
      open={open}
      onClose={closeConsole}
      effects={effects}
      navigate={navigate}
      reducedMotion={reducedMotion}
      focusToken={focusToken}
    />
  );
}

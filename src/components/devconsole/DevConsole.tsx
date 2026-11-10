"use client";

import * as React from "react";
import "./commands";
import { completeLine, runLine } from "./registry";
import type { CommandContext, ConsoleLine, LineKind } from "./registry";
import { Hud } from "./Hud";
import { CONSOLE_SLIDE_MS, consoleTheme } from "./theme";
import { TELEMETRY_READ_HZ, formatFrameLine, telemetry } from "./telemetry";
import { mulberry32 } from "../../lib/rng";
import type { EffectBus } from "../background3d/BackgroundEffectsProvider";
import { BORDER_FLASH_MS } from "./diceEffects";

type Line = ConsoleLine & { id: number };

const MAX_LINES = 500;
const MAX_HISTORY = 50;
const HISTORY_KEY = "sjb.console.history";

function loadHistory(): string[] {
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private mode or quota: history is a convenience only.
  }
}

function cryptoFloat(): number {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

const kindColor: Record<LineKind, string> = {
  in: consoleTheme.text,
  out: consoleTheme.text,
  err: consoleTheme.error,
  sys: consoleTheme.muted,
  gold: consoleTheme.accentHex,
};

type DevConsoleProps = {
  open: boolean;
  onClose: () => void;
  effects: EffectBus;
  navigate: (href: string) => void;
  reducedMotion: boolean;
  /** Bumped by the trigger on every open request so the input is refocused. */
  focusToken: number;
};

/**
 * The engine console panel plus the HUD. Lazy-loaded by ConsoleTrigger on
 * first open and kept mounted afterwards, so scrollback, history, seed and
 * the HUD survive the panel closing.
 */
export default function DevConsole({
  open,
  onClose,
  effects,
  navigate,
  reducedMotion,
  focusToken,
}: DevConsoleProps) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const [input, setInput] = React.useState("");
  const [hud, setHud] = React.useState(false);
  const [frameText, setFrameText] = React.useState("");
  const nextId = React.useRef(1);
  const historyRef = React.useRef<string[]>([]);
  const historyIndex = React.useRef<number | null>(null);
  const draftRef = React.useRef("");
  const seedRef = React.useRef<number | null>(null);
  const rngRef = React.useRef<() => number>(cryptoFloat);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const scrolledUp = React.useRef(false);
  const previousFocus = React.useRef<Element | null>(null);
  const hudRef = React.useRef(hud);
  hudRef.current = hud;
  // Reduced-motion stand-in for the wave and glitch: a 600 ms border fade on the panel.
  const [flash, setFlash] = React.useState<"nat20" | "nat1" | null>(null);
  const reducedMotionRef = React.useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  React.useEffect(() => {
    let timer: number | null = null;
    const unsubscribe = effects.subscribeEffect((event) => {
      if (event.type !== "dice" || event.outcome === "roll" || !reducedMotionRef.current) return;
      setFlash(event.outcome);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setFlash(null), BORDER_FLASH_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [effects]);

  const print = React.useCallback((text: string, kind: LineKind = "out", href?: string) => {
    const id = nextId.current++;
    setLines((prev) => [...prev, { id, kind, text, href }].slice(-MAX_LINES));
    return id;
  }, []);

  const updateLine = React.useCallback((id: number, text: string, kind?: LineKind) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, text, kind: kind ?? l.kind } : l)));
  }, []);

  React.useEffect(() => {
    historyRef.current = loadHistory();
    print("SJB engine console. Type help.", "sys");
  }, [print]);

  // Focus the input on open, hand focus back on close.
  React.useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    const el = previousFocus.current;
    if (el instanceof HTMLElement && document.contains(el)) el.focus();
    return undefined;
  }, [open, focusToken]);

  // Telemetry readers: the probe only does work while something shows it.
  React.useEffect(() => {
    telemetry.enabled = open || hud;
    return () => {
      telemetry.enabled = false;
    };
  }, [open, hud]);

  React.useEffect(() => {
    if (!open) return;
    const tick = () => setFrameText(formatFrameLine(telemetry));
    tick();
    const id = window.setInterval(tick, 1000 / TELEMETRY_READ_HZ);
    return () => window.clearInterval(id);
  }, [open]);

  // Auto-scroll unless the visitor scrolled up.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && !scrolledUp.current) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    scrolledUp.current = el.scrollTop + el.clientHeight < el.scrollHeight - 8;
  };

  const makeContext = React.useCallback(
    (): CommandContext => ({
      print,
      printLink: (text, href) => void print(text, "out", href),
      updateLine,
      clear: () => setLines([]),
      close: onClose,
      effects,
      telemetry,
      scrollTo: (sectionId) => {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      },
      navigate,
      rng: () => rngRef.current(),
      setSeed: (seed) => {
        seedRef.current = seed;
        rngRef.current = seed === null ? cryptoFloat : mulberry32(seed);
      },
      getSeed: () => seedRef.current,
      reducedMotion,
      history: historyRef.current,
      sections: () =>
        Array.from(document.querySelectorAll<HTMLElement>("main[id], main section[id]")).map((el) => el.id),
      toggleHud: () => {
        const next = !hudRef.current;
        hudRef.current = next;
        setHud(next);
        return next;
      },
    }),
    [print, updateLine, onClose, effects, navigate, reducedMotion]
  );

  const submit = async () => {
    const line = input;
    if (!line.trim()) return;
    print(line, "in");
    const history = historyRef.current;
    if (history[history.length - 1] !== line) {
      history.push(line);
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
      saveHistory(history);
    }
    historyIndex.current = null;
    setInput("");
    scrolledUp.current = false;
    await runLine(line, makeContext());
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    const history = historyRef.current;
    if (ev.key === "Enter") {
      ev.preventDefault();
      void submit();
      return;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (history.length === 0) return;
      if (historyIndex.current === null) {
        draftRef.current = input;
        historyIndex.current = history.length - 1;
      } else if (historyIndex.current > 0) {
        historyIndex.current -= 1;
      }
      setInput(history[historyIndex.current]);
      return;
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (historyIndex.current === null) return;
      if (historyIndex.current < history.length - 1) {
        historyIndex.current += 1;
        setInput(history[historyIndex.current]);
      } else {
        historyIndex.current = null;
        setInput(draftRef.current);
      }
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      const matches = completeLine(input, makeContext());
      if (matches.length === 0) return;
      const lastSpace = input.lastIndexOf(" ");
      const head = lastSpace < 0 ? "" : input.slice(0, lastSpace + 1);
      if (matches.length === 1) {
        setInput(`${head}${matches[0]} `);
        return;
      }
      let prefix = matches[0];
      for (const m of matches) while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
      setInput(`${head}${prefix}`);
      print(matches.join("  "), "sys");
      return;
    }
    if (ev.ctrlKey && (ev.key === "c" || ev.key === "C")) {
      ev.preventDefault();
      print(`${input}^C`, "in");
      setInput("");
      historyIndex.current = null;
      return;
    }
    if (ev.ctrlKey && (ev.key === "l" || ev.key === "L")) {
      ev.preventDefault();
      setLines([]);
    }
  };

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-label="Developer console"
          aria-modal="false"
          data-click-block
          className="fixed inset-x-0 top-0 z-50 flex flex-col border-b backdrop-blur"
          style={{
            height: "clamp(240px, 40vh, 480px)",
            background: consoleTheme.panel,
            borderColor: flash === "nat20" ? consoleTheme.accentHex : flash === "nat1" ? consoleTheme.error : consoleTheme.border,
            boxShadow: flash ? `inset 0 0 0 2px ${flash === "nat20" ? consoleTheme.accentHex : consoleTheme.error}` : undefined,
            transition: flash ? undefined : `border-color ${BORDER_FLASH_MS}ms ease-out, box-shadow ${BORDER_FLASH_MS}ms ease-out`,
            color: consoleTheme.text,
            fontFamily: consoleTheme.fontFamily,
            fontSize: consoleTheme.fontSize,
            animation: reducedMotion ? undefined : `sjb-console-in ${CONSOLE_SLIDE_MS}ms ease-out`,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-1"
            style={{ borderColor: consoleTheme.border }}
          >
            <span className="text-xs tracking-widest" style={{ color: consoleTheme.accentHex }}>
              SJB ENGINE CONSOLE
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: consoleTheme.muted }}>
                {frameText}
              </span>
              <button
                type="button"
                aria-label="Close console"
                onClick={onClose}
                className="rounded-sm border px-2 leading-5 hover:bg-white/10"
                style={{ borderColor: consoleTheme.border, color: consoleTheme.text }}
              >
                x
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-3 py-2"
            aria-live="polite"
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className="whitespace-pre-wrap break-words leading-5"
                style={{ color: kindColor[line.kind] }}
              >
                {line.kind === "in" ? (
                  <>
                    <span style={{ color: consoleTheme.accentHex }}>sjb&gt; </span>
                    {line.text}
                  </>
                ) : line.href ? (
                  <a
                    href={line.href}
                    target={line.href.startsWith("http") ? "_blank" : undefined}
                    rel={line.href.startsWith("http") ? "noreferrer" : undefined}
                    className="underline"
                    style={{ color: consoleTheme.accentHex }}
                  >
                    {line.text}
                  </a>
                ) : (
                  line.text
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
            className="flex items-center gap-2 border-t px-3 py-1"
            style={{ borderColor: consoleTheme.border }}
          >
            <span style={{ color: consoleTheme.accentHex }}>sjb&gt;</span>
            <input
              ref={inputRef}
              data-console-input
              aria-label="Console command"
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent outline-none"
              style={{ color: consoleTheme.text, fontFamily: consoleTheme.fontFamily, fontSize: consoleTheme.fontSize }}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </form>
        </div>
      ) : null}
      {hud ? <Hud /> : null}
    </>
  );
}

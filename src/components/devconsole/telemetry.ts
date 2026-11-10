/**
 * Renderer telemetry shared between the scene (writer) and the console and
 * HUD (readers). R3F hooks only work inside the Canvas and the console lives
 * outside it, so the probe writes this module-level object each frame and the
 * readers poll it at TELEMETRY_READ_HZ. No React state is involved.
 */
export type Telemetry = {
  /** Probe skips work when false. Readers set it while they are visible. */
  enabled: boolean;
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  dpr: number;
  width: number;
  height: number;
  frameloop: "always" | "demand";
};

export const telemetry: Telemetry = {
  enabled: false,
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
  dpr: 1,
  width: 0,
  height: 0,
  frameloop: "always",
};

/** Exponential moving average weight for frame time: m = m + a * (1000 dt - m). */
export const TELEMETRY_EMA_ALPHA = 0.1;
export const TELEMETRY_READ_HZ = 4;

/** 412000 -> "412k", 1200000 -> "1.2M". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

/** "FPS 120 | 8.3 ms", or "demand mode" when the frameloop is on demand. */
export function formatFrameLine(t: Readonly<Telemetry>): string {
  if (t.frameloop === "demand") return "demand mode";
  return `FPS ${Math.round(t.fps)} | ${t.frameMs.toFixed(1)} ms`;
}

/** The three HUD lines; the stats command prints the same snapshot. */
export function telemetryLines(t: Readonly<Telemetry>): [string, string, string] {
  return [
    formatFrameLine(t),
    `draws ${t.drawCalls} | tris ${formatCount(t.triangles)}`,
    `geo ${t.geometries} | tex ${t.textures} | dpr ${t.dpr}`,
  ];
}

"use client";

import * as React from "react";
import type { ChessColor } from "../../lib/chess/types";

const CLAMP = 600;
const VB_W = 100;
const VB_H = 100;

/**
 * Evaluation by ply as a thin area chart, my side up, clamped to +-600 cp,
 * with a marker at the current ply. Click or drag (pointer or touch) scrubs
 * the board; Left and Right step when the strip has focus.
 */
export function EvalStrip({
  evals,
  myColor,
  ply,
  onPlyChange,
}: {
  /** evals[i] is the evaluation after ply i + 1, centipawns from white's view. */
  evals: number[];
  myColor: ChessColor;
  /** Current ply, 0 = start position. */
  ply: number;
  onPlyChange: (ply: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const total = evals.length;
  const sign = myColor === "white" ? 1 : -1;
  // y: 0 at the top (me completely winning), 100 at the bottom.
  const y = (e: number) => ((CLAMP - Math.max(-CLAMP, Math.min(CLAMP, e * sign))) / (2 * CLAMP)) * VB_H;
  const x = (p: number) => (total === 0 ? 0 : (p / total) * VB_W);

  const area = total
    ? `M 0,${y(0).toFixed(1)} ` + evals.map((e, i) => `L ${x(i + 1).toFixed(2)},${y(e).toFixed(1)}`).join(" ") + ` L ${VB_W},${VB_H} L 0,${VB_H} Z`
    : "";

  const pickFromClientX = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    onPlyChange(Math.round(frac * total));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pickFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType !== "touch") return;
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    pickFromClientX(e.clientX);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: total };
    if (e.key in map) {
      e.preventDefault();
      onPlyChange(Math.max(0, Math.min(total, map[e.key])));
    }
  };

  const current = ply > 0 ? evals[ply - 1] : 0;
  const label = `Evaluation after ply ${ply}: ${current > 0 ? "+" : ""}${(current / 100).toFixed(1)} for white. Drag to scrub.`;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="slider"
      aria-label="Evaluation by move"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={ply}
      aria-valuetext={label}
      title={label}
      className="relative mt-2 h-8 w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-md border border-line bg-neutral-950/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line x1={0} x2={VB_W} y1={VB_H / 2} y2={VB_H / 2} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {area ? <path d={area} className="fill-accent-text/70" /> : null}
        {total ? (
          <line x1={x(ply)} x2={x(ply)} y1={0} y2={VB_H} className="stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
    </div>
  );
}

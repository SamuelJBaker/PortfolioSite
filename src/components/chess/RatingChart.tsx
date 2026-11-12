"use client";

import * as React from "react";
import { dayLabel, formatDelta } from "../../lib/chess/format";
import type { SeriesPoint } from "../../lib/chess/stats";
import { SegmentedToggle } from "./GameToggle";

export type ChartScale = "zoom" | "goal";

/** Unix seconds at 00:00 UTC of a YYYY-MM-DD date. */
function dateSec(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 1000;
}

function roundTo(n: number, step: number, dir: "floor" | "ceil"): number {
  return (dir === "floor" ? Math.floor(n / step) : Math.ceil(n / step)) * step;
}

/** Y domain for a scale; zoom pads 10 percent (at least 15), goal reaches the goal line. */
export function yDomain(closes: number[], goal: number, scale: ChartScale): [number, number] {
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  if (scale === "goal") return [roundTo(min, 50, "floor"), goal + 20];
  const pad = Math.max(15, Math.round((max - min) * 0.1));
  return [min - pad, max + pad];
}

/** Multiples of 25 inside the domain, thinned to at most six. */
export function yTicks([lo, hi]: [number, number]): number[] {
  const first = roundTo(lo, 25, "ceil");
  const count = Math.floor((hi - first) / 25) + 1;
  if (count <= 0) return [];
  const every = Math.ceil(count / 6);
  const ticks: number[] = [];
  for (let v = first; v <= hi; v += 25 * every) ticks.push(v);
  return ticks;
}

/** Index of the series point whose x is nearest to a 0..1 fraction. */
export function nearestIndex(xs: number[], fraction: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - fraction);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

const VB_W = 100;
const VB_H = 100;

/**
 * Rating history. The SVG is a 100x100 box stretched to the container with
 * non-scaling strokes; every label, marker and the tooltip are HTML placed in
 * percent so nothing distorts. Two scales: Zoom (default) and To goal.
 * Interaction: pointer move or touch drag snaps to the nearest day, keyboard
 * arrows step (the chart is focusable), a tap on a coarse pointer pins the
 * tooltip and a second tap clears it.
 */
export function RatingChart({
  series,
  goal,
  rating,
  startRating,
}: {
  series: SeriesPoint[];
  goal: number;
  rating: number;
  startRating: number | null;
}) {
  const [scale, setScale] = React.useState<ChartScale>("zoom");
  const [active, setActive] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState(false);
  const plotRef = React.useRef<HTMLDivElement>(null);

  const closes = series.map((p) => p.close);
  const [lo, hi] = yDomain(closes, goal, scale);
  const t0 = dateSec(series[0].date);
  const t1 = dateSec(series[series.length - 1].date);
  const span = Math.max(1, t1 - t0);
  const xs = series.map((p) => (dateSec(p.date) - t0) / span);
  const y = (r: number) => ((hi - r) / (hi - lo)) * VB_H;

  const points = series.map((p, i) => `${(xs[i] * VB_W).toFixed(2)},${y(p.close).toFixed(2)}`).join(" ");
  const last = series.length - 1;
  const minIdx = closes.indexOf(Math.min(...closes));
  const maxIdx = closes.lastIndexOf(Math.max(...closes));
  const goalVisible = goal >= lo && goal <= hi;
  // The goal line carries its own label, so a tick at the goal value is dropped.
  const ticks = yTicks([lo, hi]).filter((t) => !(goalVisible && t === goal));

  const start = startRating ?? series[0].close;
  const progress = goal > start ? Math.min(1, Math.max(0, (rating - start) / (goal - start))) : 1;
  const toGo = Math.max(0, goal - rating);

  const pick = (clientX: number) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setActive(nearestIndex(xs, (clientX - box.left) / box.width));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pinned && e.pointerType === "touch") return;
    pick(e.clientX);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const box = plotRef.current?.getBoundingClientRect();
    if (!box) return;
    const idx = nearestIndex(xs, (e.clientX - box.left) / box.width);
    if (pinned && active === idx) {
      setPinned(false);
      setActive(null);
    } else {
      setPinned(true);
      setActive(idx);
    }
  };
  const onPointerLeave = () => {
    if (!pinned) setActive(null);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = active ?? last;
    const map: Record<string, number | null> = {
      ArrowLeft: Math.max(0, cur - 1),
      ArrowRight: Math.min(last, cur + 1),
      Home: 0,
      End: last,
      Escape: null,
    };
    if (e.key in map) {
      e.preventDefault();
      setActive(map[e.key]);
      setPinned(false);
    }
  };

  const a = active !== null ? series[active] : null;
  const prev = active !== null && active > 0 ? series[active - 1].close : null;
  const tipLeft = active !== null ? xs[active] * 100 : 0;
  const tipAlign = tipLeft < 20 ? "left-0" : tipLeft > 80 ? "-translate-x-full" : "-translate-x-1/2";
  const tipText = a
    ? `${dayLabel(dateSec(a.date))}: ${a.close}, ${prev !== null ? formatDelta(a.close - prev) : "--"}, ${a.games} ${a.games === 1 ? "game" : "games"}, ${a.w}-${a.l}-${a.d}`
    : "";

  const mid = Math.floor(last / 2);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] leading-none text-neutral-500">
          {scale === "zoom" ? `goal ${goal}, ${goal - rating} above` : `goal ${goal}`}
        </p>
        <SegmentedToggle
          label="Chart scale"
          value={scale}
          onChange={(v) => setScale(v)}
          options={[
            { value: "zoom", label: "Zoom" },
            { value: "goal", label: "To goal" },
          ]}
        />
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-label="Rating chart. Use the arrow keys to move between days."
        className="relative mt-2 h-28 w-full touch-pan-y select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!pinned) setActive(null);
        }}
      >
        {/* Tick labels live in a right gutter so they never sit on the line. */}
        {ticks.map((t) => (
          <span
            key={`l-${t}`}
            className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none text-neutral-600"
            style={{ top: `${y(t)}%` }}
            aria-hidden="true"
          >
            {t}
          </span>
        ))}
        <div ref={plotRef} className="absolute inset-y-0 left-0 right-9">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={VB_W} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {goalVisible ? (
            <line x1={0} x2={VB_W} y1={y(goal)} y2={y(goal)} className="stroke-neutral-600" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          ) : null}
          <polyline points={points} fill="none" className="stroke-body" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {active !== null ? (
            <line x1={xs[active] * VB_W} x2={xs[active] * VB_W} y1={0} y2={VB_H} className="stroke-accent/60" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>

        {goalVisible ? (
          <span
            className="absolute right-0 -translate-y-full pb-0.5 font-mono text-[10px] leading-none text-neutral-500"
            style={{ top: `${y(goal)}%` }}
            aria-hidden="true"
          >
            Goal {goal}
          </span>
        ) : null}

        {[minIdx, maxIdx].map((i, k) => {
          if (i === last || (k === 1 && maxIdx === minIdx)) return null;
          const py = y(series[i].close);
          // Low labels go under the dot and peak labels above, unless that runs off the plot.
          const below = k === 0 ? py < 78 : py > 78;
          const belowCls = below ? "translate-y-1.5" : "-translate-y-[calc(100%+6px)]";
          const xCls = xs[i] < 0.1 ? "" : xs[i] > 0.9 ? " -translate-x-full" : " -translate-x-1/2";
          return (
            <React.Fragment key={`m-${k}`}>
              <span
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-body bg-ink"
                style={{ left: `${xs[i] * 100}%`, top: `${py}%` }}
                aria-hidden="true"
              />
              <span
                className={"absolute font-mono text-[10px] leading-none text-neutral-500 " + belowCls + xCls}
                style={{ left: `${xs[i] * 100}%`, top: `${py}%` }}
                aria-hidden="true"
              >
                {series[i].close}
              </span>
            </React.Fragment>
          );
        })}
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${xs[last] * 100}%`, top: `${y(series[last].close)}%` }}
          aria-hidden="true"
        />

        {a ? (
          <div
            className={"pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] leading-tight text-body whitespace-nowrap " + tipAlign}
            style={{ left: `${tipLeft}%` }}
            role="status"
          >
            <div className="text-neutral-100">{dayLabel(dateSec(a.date))}</div>
            <div>
              {a.close} <span className={prev !== null && a.close - prev > 0 ? "text-accent" : "text-muted"}>{prev !== null ? formatDelta(a.close - prev) : "--"}</span>
            </div>
            <div className="text-muted">
              {a.games} {a.games === 1 ? "game" : "games"}, {a.w}-{a.l}-{a.d}
            </div>
          </div>
        ) : null}
        </div>
        <span className="sr-only" aria-live="polite">
          {tipText}
        </span>
      </div>

      <div className="relative mr-9 mt-1 h-3 font-mono text-[10px] leading-none text-neutral-500" aria-hidden="true">
        <span className="absolute left-0">{dayLabel(dateSec(series[0].date))}</span>
        {last >= 2 ? (
          <span className="absolute -translate-x-1/2" style={{ left: `${xs[mid] * 100}%` }}>
            {dayLabel(dateSec(series[mid].date))}
          </span>
        ) : null}
        {last >= 1 ? <span className="absolute right-0">{dayLabel(dateSec(series[last].date))}</span> : null}
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Road to {goal}: <span className="text-body">{toGo}</span> to go
      </p>
    </div>
  );
}

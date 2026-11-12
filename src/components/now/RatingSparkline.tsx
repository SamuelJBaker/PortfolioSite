import * as React from "react";
import type { ChessHistoryPoint } from "../../lib/chess/types";

const Y_PAD = 25;

/**
 * Rating history as a polyline with a dashed goal line, a gold dot on the
 * latest point, and the goal progress bar under it. Y range is padded 25
 * points past min(history, goal) and max(history, goal).
 *
 * The SVG stretches to the container (preserveAspectRatio none) with
 * non-scaling strokes, so the chart is 80 px tall at every width; the goal
 * label and the dot are HTML, positioned in percent, so they never distort.
 */
export function RatingSparkline({
  history,
  goal,
  rating,
  startRating,
}: {
  history: ChessHistoryPoint[];
  goal: number;
  rating: number;
  startRating: number | null;
}) {
  const values = history.map((p) => p.r);
  const lo = Math.min(...values, goal) - Y_PAD;
  const hi = Math.max(...values, goal) + Y_PAD;
  const t0 = history[0].t;
  const t1 = history[history.length - 1].t;
  const span = Math.max(1, t1 - t0);

  // Percent coordinates; the SVG viewBox is 0..100 on both axes.
  const x = (t: number) => ((t - t0) / span) * 100;
  const y = (r: number) => ((hi - r) / (hi - lo)) * 100;

  const points = history.map((p) => `${x(p.t).toFixed(2)},${y(p.r).toFixed(2)}`).join(" ");
  const last = history[history.length - 1];
  const goalY = y(goal);

  const start = startRating ?? history[0].r;
  const progress = goal > start ? Math.min(1, Math.max(0, (rating - start) / (goal - start))) : 1;
  const toGo = Math.max(0, goal - rating);

  return (
    <div>
      <div className="relative h-20 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line
            x1={0}
            x2={100}
            y1={goalY}
            y2={goalY}
            className="stroke-neutral-600"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={points}
            fill="none"
            className="stroke-neutral-300"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute right-0 -translate-y-full pb-0.5 font-mono text-[10px] leading-none text-neutral-500"
          style={{ top: `${goalY}%` }}
          aria-hidden="true"
        >
          Goal {goal}
        </span>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${x(last.t)}%`, top: `${y(last.r)}%` }}
          aria-hidden="true"
        />
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

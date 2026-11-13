"use client";

import * as React from "react";
import { dayLabel } from "../../lib/chess/format";
import type { ReviewAccPoint } from "../../lib/chess/stats-review";
import { nearestIndex } from "./RatingChart";

const VB = 100;

function dateSec(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 1000;
}

const RESULT: Record<ReviewAccPoint["outcome"], string> = { W: "win", L: "loss", D: "draw" };

/**
 * Accuracy per reviewed game, same conventions as RatingChart: stretched
 * SVG with non-scaling strokes, HTML labels, hover / touch / keyboard
 * tooltip. One point per game, evenly spaced (several games can share a
 * day), y from 0 to 100.
 */
export function AccuracyChart({ series }: { series: ReviewAccPoint[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState(false);
  const plotRef = React.useRef<HTMLDivElement>(null);

  const last = series.length - 1;
  const xs = series.map((_, i) => (last === 0 ? 0.5 : i / last));
  const y = (acc: number) => (1 - acc / 100) * VB;
  const points = series.map((p, i) => `${(xs[i] * VB).toFixed(2)},${y(p.acc).toFixed(2)}`).join(" ");

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
  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = active ?? last;
    const map: Record<string, number | null> = { ArrowLeft: Math.max(0, cur - 1), ArrowRight: Math.min(last, cur + 1), Home: 0, End: last, Escape: null };
    if (e.key in map) {
      e.preventDefault();
      setActive(map[e.key]);
      setPinned(false);
    }
  };

  const a = active !== null ? series[active] : null;
  const tipLeft = active !== null ? xs[active] * 100 : 0;
  const tipAlign = tipLeft < 20 ? "left-0" : tipLeft > 80 ? "-translate-x-full" : "-translate-x-1/2";
  const tipText = a ? `${dayLabel(dateSec(a.date))}: accuracy ${a.acc}, ${RESULT[a.outcome]}` : "";
  const mid = Math.floor(last / 2);

  return (
    <div>
      <div
        tabIndex={0}
        role="group"
        aria-label="Accuracy per game. Use the arrow keys to move between games."
        className="relative h-24 w-full touch-pan-y select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerLeave={() => {
          if (!pinned) setActive(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!pinned) setActive(null);
        }}
      >
        {[0, 50, 100].map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2 font-mono text-[10px] leading-none text-neutral-600" style={{ top: `${y(t)}%` }} aria-hidden="true">
            {t}
          </span>
        ))}
        <div ref={plotRef} className="absolute inset-y-0 left-0 right-7">
          <svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {[50].map((t) => (
              <line key={t} x1={0} x2={VB} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <polyline points={points} fill="none" className="stroke-body" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {active !== null ? (
              <line x1={xs[active] * VB} x2={xs[active] * VB} y1={0} y2={VB} className="stroke-accent/60" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {series.map((p, i) => (
            <span
              key={i}
              className={"absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full " + (p.outcome === "W" ? "bg-accent" : p.outcome === "L" ? "bg-muted" : "bg-body")}
              style={{ left: `${xs[i] * 100}%`, top: `${y(p.acc)}%` }}
              aria-hidden="true"
            />
          ))}
          {a ? (
            <div
              className={"pointer-events-none absolute top-0 z-10 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] leading-tight text-body whitespace-nowrap " + tipAlign}
              style={{ left: `${tipLeft}%` }}
              role="status"
            >
              <div className="text-neutral-100">{dayLabel(dateSec(a.date))}</div>
              <div>
                accuracy {a.acc}, <span className={a.outcome === "W" ? "text-accent" : "text-muted"}>{RESULT[a.outcome]}</span>
              </div>
            </div>
          ) : null}
        </div>
        <span className="sr-only" aria-live="polite">
          {tipText}
        </span>
      </div>
      <div className="relative mr-7 mt-1 h-3 font-mono text-[10px] leading-none text-neutral-500" aria-hidden="true">
        <span className="absolute left-0">{dayLabel(dateSec(series[0].date))}</span>
        {last >= 2 ? (
          <span className="absolute -translate-x-1/2" style={{ left: `${xs[mid] * 100}%` }}>
            {dayLabel(dateSec(series[mid].date))}
          </span>
        ) : null}
        {last >= 1 ? <span className="absolute right-0">{dayLabel(dateSec(series[last].date))}</span> : null}
      </div>
      <p className="mt-1 text-[10px] text-neutral-500">Gold dots are wins, grey losses, light draws.</p>
    </div>
  );
}

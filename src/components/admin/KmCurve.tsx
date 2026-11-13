import * as React from "react";
import type { KaplanMeier } from "@/lib/appstats";

/**
 * Kaplan-Meier step curve of days to first response: S(day) from 1 down,
 * hand-written SVG, no client JS. Median and day90 are marked when known.
 */
export function KmCurve({ km, maxDay = 60 }: { km: KaplanMeier; maxDay?: number }) {
  const W = 640;
  const H = 220;
  const P = { top: 12, right: 16, bottom: 28, left: 40 };
  const iw = W - P.left - P.right;
  const ih = H - P.top - P.bottom;
  const lastDay = Math.max(maxDay, ...km.points.map((p) => p.day));
  const x = (day: number) => P.left + (Math.min(day, lastDay) / lastDay) * iw;
  const y = (s: number) => P.top + (1 - s) * ih;

  let d = `M ${x(0)} ${y(1)}`;
  let s = 1;
  for (const p of km.points) {
    d += ` H ${x(p.day)} V ${y(p.survival)}`;
    s = p.survival;
  }
  d += ` H ${x(lastDay)}`;
  void s;

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const dayTicks = Array.from({ length: 7 }, (_, i) => Math.round((lastDay * i) / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label={`Share without a response by day, ${km.n} applications, ${km.responses} responses`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={P.left - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}
      {dayTicks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
          {t}d
        </text>
      ))}
      <path d={d} fill="none" stroke="var(--color-accent, #8ab4f8)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {km.medianDays !== null && (
        <g>
          <line x1={x(km.medianDays)} x2={x(km.medianDays)} y1={P.top} y2={H - P.bottom} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" />
          <text x={x(km.medianDays) + 4} y={P.top + 12} fontSize={10} fill="currentColor" fillOpacity={0.8}>
            median {km.medianDays}d
          </text>
        </g>
      )}
      {km.day90 !== null && (
        <g>
          <line x1={x(km.day90)} x2={x(km.day90)} y1={P.top} y2={H - P.bottom} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="2 3" />
          <text x={x(km.day90) + 4} y={P.top + 26} fontSize={10} fill="currentColor" fillOpacity={0.8}>
            90% by {km.day90}d
          </text>
        </g>
      )}
    </svg>
  );
}

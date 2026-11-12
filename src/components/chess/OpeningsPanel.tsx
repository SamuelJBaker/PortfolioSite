import * as React from "react";
import type { OpeningStat } from "../../lib/chess/stats";

function ColorChip({ color }: { color: OpeningStat["color"] }) {
  if (color === "both") return <span className="font-mono text-[10px] text-neutral-500">W+B</span>;
  const white = color === "white";
  return (
    <span
      className={
        "inline-flex h-4 w-4 items-center justify-center rounded-sm border font-mono text-[10px] " +
        (white ? "border-neutral-600 bg-accent-text/90 text-ink" : "border-accent/60 bg-panel text-accent")
      }
      title={white ? "As white" : "As black"}
      aria-label={white ? "as white" : "as black"}
    >
      {white ? "W" : "B"}
    </span>
  );
}

/** Top opening families by games, with the score as a number and a thin bar. */
export function OpeningsPanel({ openings }: { openings: OpeningStat[] }) {
  if (openings.length === 0) return <p className="text-sm text-muted">No openings yet.</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="pb-2 pr-3 font-medium">Opening</th>
          <th className="pb-2 pr-3 font-medium">Color</th>
          <th className="pb-2 pr-3 text-right font-medium">Games</th>
          <th className="pb-2 pr-3 text-right font-medium">W-L-D</th>
          <th className="pb-2 font-medium">Score</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-panel">
        {openings.map((o) => (
          <tr key={`${o.name}|${o.color}`} className="text-body">
            <td className="py-2 pr-3">
              {o.ecoUrl ? (
                <a href={o.ecoUrl} target="_blank" rel="noreferrer" className="text-accent/90 hover:text-accent">
                  {o.name}
                </a>
              ) : (
                o.name
              )}
            </td>
            <td className="py-2 pr-3">
              <ColorChip color={o.color} />
            </td>
            <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums">{o.games}</td>
            <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums">
              {o.w}-{o.l}-{o.d}
            </td>
            <td className="py-2">
              <div className="flex items-center gap-2">
                <span className="w-12 font-mono text-xs tabular-nums">{o.scorePct}%</span>
                <span className="h-1 w-20 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${o.scorePct}%` }} />
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import * as React from "react";
import type { ChessOutcome } from "../../lib/chess/types";

const TONE: Record<ChessOutcome, string> = { W: "text-accent", L: "text-muted", D: "text-body" };

/** Last results as W, L, D letters, oldest first, with a count in the title. */
export function FormStrip({ form }: { form: ChessOutcome[] }) {
  if (form.length === 0) return null;
  const w = form.filter((o) => o === "W").length;
  const l = form.filter((o) => o === "L").length;
  const d = form.length - w - l;
  const title = `Last ${form.length}: ${w} wins, ${l} losses, ${d} draws`;
  return (
    <p className="mt-2 font-mono text-xs" title={title} aria-label={title}>
      <span className="text-neutral-500">Last {form.length}: </span>
      {form.map((o, i) => (
        <span key={i} className={TONE[o] + (i ? " ml-1" : "")} aria-hidden="true">
          {o}
        </span>
      ))}
    </p>
  );
}

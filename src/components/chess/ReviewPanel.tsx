import * as React from "react";
import type { ChessReview } from "../../lib/chess/types";
import { AccuracyChart } from "./AccuracyChart";
import { CLASS_META, CLASS_ORDER } from "./classes";

function acc(n: number | null): string {
  return n === null ? "--" : n.toFixed(1);
}

/** The Review tab: our own Stockfish analysis over the last 30 reviewed games. */
export function ReviewPanel({ review }: { review: ChessReview }) {
  const a = review.aggregate;
  const maxPer100 = Math.max(1, ...Object.values(a.countsPer100));
  const b = review.blundersPerGame;
  const trend =
    b.current !== null && b.previous !== null
      ? b.current < b.previous
        ? `down from ${b.previous.toFixed(1)}`
        : b.current > b.previous
          ? `up from ${b.previous.toFixed(1)}`
          : `unchanged from ${b.previous.toFixed(1)}`
      : "no earlier window yet";

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-3xl font-semibold text-neutral-100">{acc(a.avgAcc)}</span>
        <span className="text-xs uppercase tracking-widest text-muted">accuracy</span>
        <span className="text-xs text-neutral-500">
          last {a.games} reviewed {a.games === 1 ? "game" : "games"}: wins {acc(a.avgAccWins)}, losses {acc(a.avgAccLosses)}
        </span>
      </div>

      {a.accSeries.length > 0 ? (
        <div className="mt-3">
          <AccuracyChart series={a.accSeries} />
        </div>
      ) : null}

      <h4 className="mt-4 text-xs uppercase tracking-widest text-muted">Move quality, per 100 of my moves</h4>
      <ul className="mt-2 space-y-1">
        {CLASS_ORDER.filter((c) => a.countsPer100[c]).map((c) => {
          const m = CLASS_META[c];
          const n = a.countsPer100[c] ?? 0;
          return (
            <li key={c} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-right font-mono text-xs" style={{ color: m.color }} aria-hidden="true">
                {m.glyph}
              </span>
              <span className="w-24 text-body">{m.word}</span>
              <span className="w-12 text-right font-mono text-xs tabular-nums text-body">{n.toFixed(1)}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${(n / maxPer100) * 100}%`, background: m.color }} />
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm text-body">
        <span className="text-muted">Blunders per game: </span>
        <span className="font-mono">{b.current === null ? "--" : b.current.toFixed(1)}</span>
        <span className="text-muted">, {trend}</span>
      </p>
    </div>
  );
}

import * as React from "react";
import { dayLabel, formatDelta } from "../../lib/chess/format";
import type { ActivityCell, ColorStats, EndingStats, ExpectationStats, StreakInfo, TerminationCounts } from "../../lib/chess/stats";
import type { ChessColor, ChessOutcome, ChessTermination } from "../../lib/chess/types";
import { TERMINATIONS } from "../../lib/chess/types";

const TERM_LABEL: Record<ChessTermination, string> = {
  checkmate: "checkmate",
  resign: "resignation",
  timeout: "time",
  abandoned: "abandoned",
  stalemate: "stalemate",
  repetition: "repetition",
  agreed: "agreed",
  insufficient: "insufficient material",
  other: "other",
};

/** Segment shades: the first segment is the strongest. Wins in accent, losses in body. */
const WIN_SHADES = ["bg-accent", "bg-accent/70", "bg-accent/45", "bg-accent/25"];
const LOSS_SHADES = ["bg-body/80", "bg-body/55", "bg-body/35", "bg-body/20"];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-panel/30 p-4">
      <h4 className="text-xs uppercase tracking-widest text-muted">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ColorRow({ label, s }: { label: string; s: ColorStats }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-body">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">
          {s.games} games, {s.w}-{s.l}-{s.d}, {s.scorePct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${s.scorePct}%` }} />
      </div>
    </div>
  );
}

function sortedTerms(counts: TerminationCounts): [ChessTermination, number][] {
  return TERMINATIONS.map((t) => [t, counts[t] ?? 0] as [ChessTermination, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

function EndingBar({ label, counts, shades }: { label: string; counts: TerminationCounts; shades: string[] }) {
  const terms = sortedTerms(counts);
  const total = terms.reduce((s, [, n]) => s + n, 0);
  const text = terms.map(([t, n]) => `${n} by ${TERM_LABEL[t]}`).join(", ");
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-body">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">{total}</span>
      </div>
      <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-line" title={text || "none"} aria-hidden="true">
        {terms.map(([t, n], i) => (
          <span key={t} className={"h-full " + (shades[i] ?? shades[shades.length - 1])} style={{ width: `${(n / total) * 100}%` }} />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{text || "none yet"}</p>
    </div>
  );
}

function streakWord(kind: ChessOutcome | null, n: number): string {
  if (!kind || n === 0) return "none";
  const word = kind === "W" ? "win" : kind === "L" ? "loss" : "draw";
  return `${n} ${word}${n === 1 ? "" : kind === "L" ? "es" : "s"}`;
}

function cellClass(c: ActivityCell): string {
  if (c.games === 0) return "bg-line/60";
  const tone = c.net > 0 ? "bg-accent" : c.net < 0 ? "bg-body" : "bg-neutral-500";
  const level = c.games >= 4 ? "" : c.games >= 2 ? "/70" : "/40";
  return tone + level;
}

function ActivityGrid({ cells }: { cells: ActivityCell[] }) {
  const played = cells.filter((c) => c.games > 0);
  const games = played.reduce((s, c) => s + c.games, 0);
  const net = played.reduce((s, c) => s + c.net, 0);
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Last 12 weeks: ${games} games on ${played.length} days, net ${formatDelta(net)}.`}>
        {cells.map((c) => (
          <span
            key={c.date}
            className={"h-2.5 w-2.5 rounded-[2px] " + cellClass(c)}
            title={`${dayLabel(Date.parse(c.date + "T00:00:00Z") / 1000)}: ${c.games} ${c.games === 1 ? "game" : "games"}${c.games ? `, ${formatDelta(c.net)}` : ""}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {games} games on {played.length} days, net <span className={net > 0 ? "text-accent" : "text-body"}>{formatDelta(net)}</span>. Gold days went up, grey days went down.
      </p>
    </div>
  );
}

export function BreakdownPanel({
  colorSplit,
  endings,
  expectation,
  streak,
  activity,
}: {
  colorSplit: Record<ChessColor, ColorStats>;
  endings: EndingStats;
  expectation: ExpectationStats;
  streak: StreakInfo;
  activity: ActivityCell[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Block title="By color">
        <ColorRow label="As white" s={colorSplit.white} />
        <ColorRow label="As black" s={colorSplit.black} />
      </Block>
      <Block title="How games end">
        <EndingBar label="Wins" counts={endings.wins} shades={WIN_SHADES} />
        <EndingBar label="Losses" counts={endings.losses} shades={LOSS_SHADES} />
      </Block>
      <Block title="Score vs expectation">
        <p className="font-mono text-sm text-body">
          actual {expectation.actual}, expected {expectation.expected},{" "}
          <span className={expectation.delta > 0 ? "text-accent" : "text-muted"}>{formatDelta(expectation.delta)}</span>
        </p>
        <p className="mt-2 text-xs text-muted">
          Expected is the Elo prediction from the opponents&apos; ratings over {expectation.games} games; above zero means
          I scored more than the ratings predicted.
        </p>
      </Block>
      <Block title="Streaks">
        <p className="text-sm text-body">
          Current: <span className="font-mono">{streakWord(streak.current.kind, streak.current.length)}</span>
        </p>
        <p className="mt-1 text-sm text-body">
          Best win streak: <span className="font-mono">{streak.bestWin}</span>
        </p>
      </Block>
      <div className="sm:col-span-2 xl:col-span-1">
        <Block title="Activity, last 12 weeks">
          <ActivityGrid cells={activity} />
        </Block>
      </div>
    </div>
  );
}

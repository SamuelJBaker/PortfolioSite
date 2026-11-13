import { chess } from "../../../content/chess";
import { formatDelta, lastGameLine, monthLabel } from "../../../lib/chess/format";
import { CLASSES } from "../../../lib/chess/classify";
import type { OpeningStat } from "../../../lib/chess/stats";
import type { ChessSummary } from "../../../lib/chess/types";
import { register } from "../registry";

async function loadSummary(): Promise<ChessSummary | null> {
  try {
    const res = await fetch("/api/chess");
    const s = (await res.json()) as ChessSummary;
    return s.ok ? s : null;
  } catch {
    return null;
  }
}

function pad(text: string, width: number, right = false): string {
  const t = text.length > width ? text.slice(0, width - 1) + "~" : text;
  return right ? t.padStart(width) : t.padEnd(width);
}

const COLOR_LABEL: Record<OpeningStat["color"], string> = { white: "W", black: "B", both: "W+B" };

/** The openings table as aligned monospace text. */
export function openingsTable(openings: OpeningStat[]): string[] {
  if (openings.length === 0) return ["no openings yet"];
  const nameWidth = Math.min(44, Math.max(7, ...openings.map((o) => o.name.length)));
  const lines = [`${pad("opening", nameWidth)}  ${pad("color", 5)}  ${pad("games", 5, true)}  ${pad("w-l-d", 8, true)}  ${pad("score", 6, true)}`];
  for (const o of openings) {
    lines.push(
      `${pad(o.name, nameWidth)}  ${pad(COLOR_LABEL[o.color], 5)}  ${pad(String(o.games), 5, true)}  ${pad(`${o.w}-${o.l}-${o.d}`, 8, true)}  ${pad(`${o.scorePct}%`, 6, true)}`
    );
  }
  return lines;
}

function streakText(s: ChessSummary): string {
  const { kind, length } = s.streak.current;
  if (!kind || length === 0) return "none";
  const word = kind === "W" ? "win" : kind === "L" ? "loss" : "draw";
  return `${length} ${word}${length === 1 ? "" : kind === "L" ? "es" : "s"}`;
}

register({
  name: "chess",
  summary: "Rapid rating, deltas, form, streak, top opening; 'chess openings' or 'chess review'",
  usage: "chess [openings|review]",
  run: async ([sub], ctx) => {
    const s = await loadSummary();
    if (!s) {
      ctx.print("chess: stats unavailable.", "err");
      return;
    }
    if ((sub ?? "").toLowerCase() === "openings") {
      for (const line of openingsTable(s.openings)) ctx.print(line);
      return;
    }
    if ((sub ?? "").toLowerCase() === "review") {
      const r = s.review;
      if (!r || r.coverage.reviewed === 0) {
        ctx.print("chess review: no reviewed games yet.", "sys");
        return;
      }
      const a = r.aggregate;
      const f = (n: number | null) => (n === null ? "--" : n.toFixed(1));
      ctx.print(`accuracy ${f(a.avgAcc)} over the last ${a.games} reviewed (wins ${f(a.avgAccWins)}, losses ${f(a.avgAccLosses)})`);
      ctx.print("per 100 moves: " + CLASSES.filter((c) => a.countsPer100[c]).map((c) => `${c} ${a.countsPer100[c]}`).join(", "));
      const b = r.blundersPerGame;
      ctx.print(`blunders per game ${f(b.current)}${b.previous !== null ? ` (previous window ${f(b.previous)})` : ""}`);
      ctx.print(`coverage ${r.coverage.reviewed}/${r.coverage.total} games; ${r.engine}, depth ${r.depth}; own classification, not chess.com labels`, "sys");
      return;
    }
    const peak = s.peak !== null ? ` (peak ${s.peak})` : "";
    const d30Label = s.d30Ref?.fallback ? "since first game" : "30 days";
    ctx.print(`${chess.displayName}: rapid ${s.rating ?? "--"}${peak}, goal ${s.goal}`);
    ctx.print(
      `${d30Label} ${formatDelta(s.deltas.d30)} | since ${monthLabel(chess.trackSince)} ${formatDelta(s.deltas.sinceTrack)} | from low ${formatDelta(s.deltas.fromLow)}`
    );
    if (s.form.length) ctx.print(`form: ${s.form.join(" ")} | streak: ${streakText(s)} | best win streak: ${s.streak.bestWin}`);
    const top = s.openings.find((o) => o.name !== "Other");
    if (top) ctx.print(`top opening: ${top.name} as ${COLOR_LABEL[top.color].toLowerCase()}, ${top.games} games, ${top.scorePct}%`);
    if (s.lastGame) ctx.printLink(`last: ${lastGameLine(s.lastGame)}`, s.lastGame.url);
    else ctx.print("last: no rated game yet", "sys");
  },
  complete: (partial) => ["openings", "review"].filter((o) => o.startsWith(partial.toLowerCase())),
});

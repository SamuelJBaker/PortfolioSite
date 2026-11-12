import { chess } from "../../../content/chess";
import { formatDelta, lastGameLine, monthLabel } from "../../../lib/chess/format";
import type { ChessSummary } from "../../../lib/chess/types";
import { register } from "../registry";

register({
  name: "chess",
  summary: "Current rapid rating, deltas and the last game",
  run: async (_args, ctx) => {
    let s: ChessSummary;
    try {
      const res = await fetch("/api/chess");
      s = (await res.json()) as ChessSummary;
    } catch {
      ctx.print("chess: stats unavailable.", "err");
      return;
    }
    if (!s.ok) {
      ctx.print("chess: stats unavailable.", "err");
      return;
    }
    const peak = s.peak !== null ? ` (peak ${s.peak})` : "";
    ctx.print(`${chess.displayName}: rapid ${s.rating ?? "--"}${peak}, goal ${s.goal}`);
    ctx.print(
      `30 days ${formatDelta(s.deltas.d30)} | since ${monthLabel(chess.trackSince)} ${formatDelta(s.deltas.sinceTrack)} | from low ${formatDelta(s.deltas.fromLow)}`
    );
    if (s.lastGame) ctx.printLink(`last: ${lastGameLine(s.lastGame)}`, s.lastGame.url);
    else ctx.print("last: no rated game yet", "sys");
  },
});

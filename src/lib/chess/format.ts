/** Small pure formatters shared by the chess card and the console command. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "+12", "-8", "0"; "--" for null. */
export function formatDelta(n: number | null): string {
  if (n === null) return "--";
  if (n > 0) return `+${n}`;
  return String(n);
}

/** "2026-11" -> "Nov 2026" */
export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTHS[m - 1] ?? "?"} ${y}`;
}

/** Unix seconds -> "Oct 21" (UTC). */
export function dayLabel(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Unix seconds -> "just now", "3 hours ago", "2 days ago", "Oct 21". */
export function relativeTime(tSec: number, nowSec: number = Math.floor(Date.now() / 1000)): string {
  const diff = Math.max(0, nowSec - tSec);
  if (diff < 3600) return "just now";
  const hours = Math.floor(diff / 3600);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(diff / 86400);
  if (days < 14) return days === 1 ? "1 day ago" : `${days} days ago`;
  return dayLabel(tSec);
}

export function outcomeWord(outcome: "W" | "L" | "D"): string {
  return outcome === "W" ? "won" : outcome === "L" ? "lost" : "drew";
}

/** "W vs 1234 (Scandinavian Defense), 2 days ago" */
export function lastGameLine(
  game: { outcome: "W" | "L" | "D"; oppRating: number; opening: string | null; endTime: number },
  nowSec?: number
): string {
  const opening = game.opening ? ` (${game.opening})` : "";
  return `${game.outcome} vs ${game.oppRating}${opening}, ${relativeTime(game.endTime, nowSec)}`;
}

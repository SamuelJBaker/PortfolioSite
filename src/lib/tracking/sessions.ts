import { classifySessions, type SessionClass } from "./classify";

/**
 * Session classes over the whole events table, for the admin pages. Read
 * time only; nothing is stored (Step 3 of phase 8).
 */

export interface EventRowFull {
  id: number;
  session_id: string;
  key: string | null;
  event: string;
  ts: string;
  country: string | null;
  ua: string | null;
  cf_threat_score: number | null;
  has_js: number | null;
  payload: string | null;
}

export interface SessionClasses {
  rows: EventRowFull[];
  classes: Map<string, SessionClass>;
  counts: Record<SessionClass, number>;
}

export async function loadSessionClasses(db: D1Database): Promise<SessionClasses> {
  const r = await db
    .prepare(`SELECT id, session_id, key, event, ts, country, ua, cf_threat_score, has_js, payload FROM events ORDER BY ts, id`)
    .all<EventRowFull>();
  const rows = r.results ?? [];
  const classes = classifySessions(rows);
  const counts: Record<SessionClass, number> = { bot: 0, human: 0, unknown: 0 };
  for (const c of classes.values()) counts[c]++;
  return { rows, classes, counts };
}

/** Rows minus bot sessions, unless bots are shown. */
export function filterBots<T extends { session_id: string }>(rows: T[], classes: Map<string, SessionClass>, showBots: boolean): T[] {
  if (showBots) return rows;
  return rows.filter((r) => classes.get(r.session_id) !== "bot");
}

export function showBotsParam(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

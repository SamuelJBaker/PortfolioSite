import { isBotUserAgent } from "./bots";

/**
 * Session classification, computed at read time from all events of one
 * session (model section 9: bot and scanner visits never count toward V).
 * Nothing is stored.
 */

export type SessionClass = "bot" | "human" | "unknown";

export interface SessionEventRow {
  event: string;
  ua?: string | null;
  cf_threat_score?: number | null;
  has_js?: number | null;
  /** JSON text as stored, or an already parsed object. */
  payload?: string | Record<string, unknown> | null;
}

export const BOT_THREAT_SCORE = 30;
export const HUMAN_DWELL_MS = 5000;

/** Events that, together with a long enough dwell, show a person was on the page. */
export const ACTIVITY_EVENTS = new Set(["section_view", "resume_open", "resume_download", "project_click", "outbound_click"]);

function parsePayload(p: SessionEventRow["payload"]): Record<string, unknown> | null {
  if (!p) return null;
  if (typeof p === "object") return p;
  try {
    const v = JSON.parse(p) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function classifySession(events: readonly SessionEventRow[]): SessionClass {
  const visit = events.find((e) => e.event === "visit_server");
  const hasJs = events.some((e) => e.has_js === 1);

  // bot: a listed user agent, or no JS at all with a high threat score
  if (visit) {
    if (isBotUserAgent(visit.ua)) return "bot";
    const score = visit.cf_threat_score;
    if (!hasJs && typeof score === "number" && score > BOT_THREAT_SCORE) return "bot";
  }

  // human: engaged, or a real dwell plus some activity
  if (events.some((e) => e.event === "engaged")) return "human";
  const longDwell = events.some((e) => {
    if (e.event !== "dwell") return false;
    const ms = parsePayload(e.payload)?.visible_ms;
    return typeof ms === "number" && ms >= HUMAN_DWELL_MS;
  });
  if (longDwell && events.some((e) => ACTIVITY_EVENTS.has(e.event))) return "human";

  return "unknown";
}

/** Group rows by session id and classify each; rows must carry session_id. */
export function classifySessions<T extends SessionEventRow & { session_id: string }>(rows: readonly T[]): Map<string, SessionClass> {
  const bySession = new Map<string, T[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_id);
    if (list) list.push(r);
    else bySession.set(r.session_id, [r]);
  }
  const out = new Map<string, SessionClass>();
  for (const [sid, list] of bySession) out.set(sid, classifySession(list));
  return out;
}

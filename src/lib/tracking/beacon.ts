/**
 * Beacon route rules, pure over a minimal lookup so they are testable.
 *
 * The key of every event in a session is the key of that session's
 * visit_server row, written by /v/[key] from the referral_keys table. A
 * client-supplied key (body or Referer) is never used: a session that did not
 * come through /v/[key] has no key.
 */

/** Event names the beacon route accepts. The first five are the pre-phase-8 names, kept so old clients still land. */
export const BEACON_EVENTS = new Set([
  "visit_confirmed",
  "scroll_depth",
  "section_dwell",
  "link_click",
  "session_end",
  "section_view",
  "resume_open",
  "resume_download",
  "project_click",
  "outbound_click",
  "engaged",
  "dwell",
]);

export const MAX_SESSION_ID = 64;
export const MAX_PAYLOAD_JSON = 1024;

export interface VisitServerRow {
  key: string | null;
}

export interface SessionLookup {
  /** The visit_server row for a session id, or null when the session never went through /v/[key]. */
  visitServerRow(sessionId: string): Promise<VisitServerRow | null>;
}

/**
 * The key to store on an event. Only the visit_server row decides; the extra
 * arguments exist so the rule is explicit about what it ignores.
 */
export async function resolveEventKey(
  lookup: SessionLookup,
  sessionId: string,
  ignoredBodyKey?: unknown,
  ignoredRefererKey?: unknown
): Promise<string | null> {
  void ignoredBodyKey;
  void ignoredRefererKey;
  const row = await lookup.visitServerRow(sessionId);
  if (!row) return null;
  return row.key ?? null;
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SESSION_ID;
}

export function isBeaconEvent(value: unknown): value is string {
  return typeof value === "string" && BEACON_EVENTS.has(value);
}

/** Payload as stored: a JSON object under the size cap, else null. */
export function normalizePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const json = JSON.stringify(payload);
  return json.length <= MAX_PAYLOAD_JSON ? json : null;
}

/**
 * Resume version rules shared by the admin page and the stamping route.
 * Pure; the D1 and R2 access lives in store.ts.
 */

export const RESUME_STATUSES = ["live", "default", "retired"] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

/** At most this many versions may be live or default at once (model section 4). */
export const MAX_ACTIVE_VERSIONS = 3;

export const VERSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ResumeVersion {
  id: string;
  label: string;
  created_at: string;
  r2_key: string;
  content_hash: string;
  factors: string;
  status: ResumeStatus;
  notes: string | null;
}

export function isResumeStatus(value: unknown): value is ResumeStatus {
  return typeof value === "string" && (RESUME_STATUSES as readonly string[]).includes(value);
}

export function isActiveStatus(status: ResumeStatus): boolean {
  return status === "live" || status === "default";
}

/** A slug from a label: lowercase, a-z 0-9 and single dashes. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function r2KeyFor(id: string): string {
  return `resumes/${id}.pdf`;
}

/** "name=level" lines (or "name: level") to a factor object; blank lines skipped. Returns an error message on a bad line. */
export function parseFactors(text: string): { factors: Record<string, string> } | { error: string } {
  const factors: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([^=:]+)[=:](.+)$/.exec(line);
    if (!m) return { error: `Factor line "${line}" must be name=level.` };
    const name = m[1].trim().toLowerCase();
    const level = m[2].trim();
    if (!name || !level) return { error: `Factor line "${line}" must be name=level.` };
    factors[name] = level;
  }
  return { factors };
}

export function factorsToText(json: string): string {
  return Object.entries(parseFactorsJson(json))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

export function parseFactorsJson(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (typeof val === "string") out[k] = val;
    return out;
  } catch {
    return {};
  }
}

/** Can `id` take `next` given the other versions' statuses? Null when fine, else the message. */
export function activeLimitError(versions: readonly Pick<ResumeVersion, "id" | "status">[], id: string, next: ResumeStatus): string | null {
  if (!isActiveStatus(next)) return null;
  const others = versions.filter((v) => v.id !== id && isActiveStatus(v.status)).length;
  if (others >= MAX_ACTIVE_VERSIONS) return `At most ${MAX_ACTIVE_VERSIONS} versions may be live or default at once.`;
  return null;
}

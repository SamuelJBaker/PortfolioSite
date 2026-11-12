/** Shared types for the Now section (D1 table now_items, /api/now, /admin/now). */

export const NOW_KINDS = ["reading", "watching", "playing", "building"] as const;
export type NowKind = (typeof NOW_KINDS)[number];

export interface NowItem {
  id: number;
  kind: NowKind;
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  note: string | null;
  url: string | null;
  sort: number;
  active: number;
  /** Unix milliseconds of the last write. */
  updated_at: number;
}

export interface NowResponse {
  ok: boolean;
  items: NowItem[];
  fetchedAt: string;
}

export function isNowKind(value: unknown): value is NowKind {
  return typeof value === "string" && (NOW_KINDS as readonly string[]).includes(value);
}

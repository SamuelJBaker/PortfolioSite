import type { StatsConfig } from "./config";
import { applicationOutcome, type Stage } from "./outcomes";
import type { ApplicationInput } from "./types";

const MS_PER_WEEK = 7 * 86400000;

export interface WeekRow {
  /** ISO date (UTC Monday) the week starts on. */
  weekStart: string;
  sent: number;
  effortHours: number;
  resolved: number;
  positives: number;
  humanVisits: number;
  /** Applied rows by current stage; filled on the current week only. */
  pipeline: Partial<Record<Stage, number>>;
}

/** UTC Monday 00:00 on or before `iso`, as a timestamp. */
export function weekStartMs(iso: string): number {
  const d = new Date(Date.parse(iso));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

/**
 * Model section 10, view 6: throughput per ISO week, current week first.
 * sent and effortHours bucket by applied_at; resolved by the resolving time
 * (the advance, the rejection, or applied_at + tDays when ghosted);
 * positives by the advance; humanVisits by session time across all keys.
 */
export function weekly(apps: ApplicationInput[], now: string, config: StatsConfig, weeks = 5): WeekRow[] {
  const current = weekStartMs(now);
  const rows: WeekRow[] = [];
  for (let i = 0; i < weeks; i++) {
    rows.push({
      weekStart: new Date(current - i * MS_PER_WEEK).toISOString().slice(0, 10),
      sent: 0,
      effortHours: 0,
      resolved: 0,
      positives: 0,
      humanVisits: 0,
      pipeline: {},
    });
  }
  const index = (iso: string | null): number => {
    if (!iso) return -1;
    const t = Date.parse(iso);
    if (t > Date.parse(now)) return -1;
    const i = Math.floor((current - weekStartMs(iso)) / MS_PER_WEEK);
    return i >= 0 && i < weeks ? i : -1;
  };

  for (const app of apps) {
    if (!app.appliedAt) continue;
    const o = applicationOutcome(app, now, config);
    const sentAt = index(app.appliedAt);
    if (sentAt >= 0) {
      rows[sentAt].sent += 1;
      rows[sentAt].effortHours += (app.effortMinutes ?? 0) / 60;
    }
    const resolvedAt = index(o.resolvedAt);
    if (resolvedAt >= 0) rows[resolvedAt].resolved += 1;
    const positiveAt = index(o.advanceAt);
    if (positiveAt >= 0) rows[positiveAt].positives += 1;
    for (const s of app.sessions) {
      if (s.cls !== "human") continue;
      const at = index(s.at);
      if (at >= 0) rows[at].humanVisits += 1;
    }
    rows[0].pipeline[o.stage] = (rows[0].pipeline[o.stage] ?? 0) + 1;
  }
  return rows;
}

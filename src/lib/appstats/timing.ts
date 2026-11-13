import type { StatsConfig } from "./config";
import { applicationOutcome } from "./outcomes";
import type { ApplicationInput } from "./types";

/** Responses needed before day90 is reported (model section 7). */
export const DAY90_MIN_RESPONSES = 20;

export interface KmPoint {
  day: number;
  /** S(day): share still without a response after `day`. */
  survival: number;
  atRisk: number;
  events: number;
}

export interface KaplanMeier {
  points: KmPoint[];
  /** Smallest day with S <= 0.5; null when the curve never gets there. */
  medianDays: number | null;
  /** The day by which 90 percent of the responses that ever arrive have arrived; null until DAY90_MIN_RESPONSES. */
  day90: number | null;
  responses: number;
  /** Rows in the curve, responded or censored. */
  n: number;
}

/**
 * Kaplan-Meier on days to first response (whole days). Rows without a
 * response are right-censored at their age, or at the withdrawal day when
 * the applicant withdrew first.
 */
export function kaplanMeier(
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig,
  filter: { ats?: string } = {}
): KaplanMeier {
  const rows: { time: number; event: boolean }[] = [];
  for (const app of apps) {
    if (!app.appliedAt) continue;
    if (filter.ats !== undefined && app.ats !== filter.ats) continue;
    const o = applicationOutcome(app, now, config);
    if (o.ageDays === null) continue;
    if (o.daysToFirstResponse !== null) {
      rows.push({ time: Math.max(0, Math.floor(o.daysToFirstResponse)), event: true });
    } else {
      const censorAt =
        o.withdrawnAt !== null ? Math.min(o.ageDays, (Date.parse(o.withdrawnAt) - Date.parse(app.appliedAt)) / 86400000) : o.ageDays;
      rows.push({ time: Math.max(0, Math.floor(censorAt)), event: false });
    }
  }

  const eventDays = [...new Set(rows.filter((r) => r.event).map((r) => r.time))].sort((a, b) => a - b);
  const points: KmPoint[] = [{ day: 0, survival: 1, atRisk: rows.length, events: 0 }];
  let s = 1;
  let medianDays: number | null = null;
  for (const day of eventDays) {
    const atRisk = rows.filter((r) => r.time >= day).length;
    const events = rows.filter((r) => r.event && r.time === day).length;
    if (atRisk === 0) continue;
    s *= 1 - events / atRisk;
    points.push({ day, survival: s, atRisk, events });
    if (medianDays === null && s <= 0.5) medianDays = day;
  }

  const responses = rows.filter((r) => r.event).length;
  let day90: number | null = null;
  if (responses >= DAY90_MIN_RESPONSES && points.length > 1) {
    const total = 1 - points[points.length - 1].survival;
    for (const p of points) {
      if (p.day === 0 && p.events === 0) continue;
      if (1 - p.survival >= 0.9 * total - 1e-12) {
        day90 = p.day;
        break;
      }
    }
  }

  return { points, medianDays, day90, responses, n: rows.length };
}

/** One curve per ATS value present among applied rows. */
export function timingByAts(apps: ApplicationInput[], now: string, config: StatsConfig): Record<string, KaplanMeier> {
  const out: Record<string, KaplanMeier> = {};
  const values = [...new Set(apps.filter((a) => a.appliedAt && a.ats).map((a) => a.ats as string))].sort();
  for (const ats of values) out[ats] = kaplanMeier(apps, now, config, { ats });
  return out;
}

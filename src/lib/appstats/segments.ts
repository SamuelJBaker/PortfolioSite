import type { StatsConfig } from "./config";
import { applicationOutcome, resolvedRows } from "./outcomes";
import { betaInterval } from "./rng";
import type { ApplicationInput } from "./types";

/** Dimensions of model section 5, in display order. */
export const DIMENSIONS = [
  "ats",
  "sourceChannel",
  "roleFamily",
  "workMode",
  "level",
  "companySizeBand",
  "industry",
  "coverLetter",
  "referral",
  "fit",
  "postingAge",
  "salary",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const SMALL_CELL = 10;

export interface SegmentStat {
  dimension: Dimension;
  level: string;
  n: number;
  k: number;
  /** Shrunk rate (k + m p0) / (n + m). */
  rate: number;
  interval: [number, number];
  /** n < SMALL_CELL: shown greyed. */
  small: boolean;
  /** Mean effort over applied rows in the cell (resolved or not), null when none recorded effort. */
  meanEffortHours: number | null;
  yieldPerHour: number | null;
}

export interface SalaryTerciles {
  /** Cut points; a midpoint under cuts[0] is "low", under cuts[1] is "mid", else "high". */
  cuts: [number, number] | null;
}

export function postingAgeBucket(days: number | null): string | null {
  if (days === null || !Number.isFinite(days)) return null;
  if (days <= 3) return "0-3";
  if (days <= 7) return "4-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  return "31+";
}

export function salaryMidpoint(app: ApplicationInput): number | null {
  const { salaryMin, salaryMax } = app;
  if (salaryMin === null && salaryMax === null) return null;
  if (salaryMin !== null && salaryMax !== null) return (salaryMin + salaryMax) / 2;
  return salaryMin ?? salaryMax;
}

/** Tercile cut points of the salary midpoints over the applications so far. */
export function salaryTerciles(apps: ApplicationInput[]): SalaryTerciles {
  const mids = apps.map(salaryMidpoint).filter((m): m is number => m !== null).sort((a, b) => a - b);
  if (mids.length === 0) return { cuts: null };
  const at = (q: number) => mids[Math.min(mids.length - 1, Math.floor(q * mids.length))];
  return { cuts: [at(1 / 3), at(2 / 3)] };
}

export function salaryBucket(mid: number | null, terciles: SalaryTerciles): string | null {
  if (mid === null || terciles.cuts === null) return null;
  if (mid < terciles.cuts[0]) return "low";
  if (mid < terciles.cuts[1]) return "mid";
  return "high";
}

/** The level of one application on one dimension, null when unknown. */
export function levelOf(app: ApplicationInput, dimension: Dimension, terciles: SalaryTerciles): string | null {
  switch (dimension) {
    case "ats":
      return app.ats;
    case "sourceChannel":
      return app.sourceChannel;
    case "roleFamily":
      return app.roleFamily;
    case "workMode":
      return app.workMode;
    case "level":
      return app.level;
    case "companySizeBand":
      return app.companySizeBand;
    case "industry":
      return app.industry;
    case "coverLetter":
      return app.coverLetter;
    case "referral":
      return app.referral ? "yes" : "no";
    case "fit":
      return app.fit === null ? null : String(app.fit);
    case "postingAge":
      return postingAgeBucket(app.postingAgeDays);
    case "salary":
      return salaryBucket(salaryMidpoint(app), terciles);
  }
}

/** Overall resolved rate p0; the prior mean when nothing is resolved yet. */
export function overallRate(apps: ApplicationInput[], now: string, config: StatsConfig): { p0: number; n: number; k: number } {
  const rows = resolvedRows(apps, now, config);
  const n = rows.length;
  const k = rows.filter((r) => r.outcome.y === 1).length;
  return { p0: n === 0 ? config.a0 / (config.a0 + config.b0) : k / n, n, k };
}

export function shrunkRate(k: number, n: number, p0: number, m: number): { rate: number; interval: [number, number] } {
  return { rate: (k + m * p0) / (n + m), interval: betaInterval(k + m * p0, n - k + m * (1 - p0)) };
}

export function yieldPerHour(rate: number, meanEffortHours: number | null): number | null {
  if (meanEffortHours === null || meanEffortHours <= 0) return null;
  return rate / meanEffortHours;
}

/** Model section 5: shrunk rate and interval per level per dimension. */
export function segmentStats(apps: ApplicationInput[], now: string, config: StatsConfig): SegmentStat[] {
  const terciles = salaryTerciles(apps);
  const { p0 } = overallRate(apps, now, config);
  const resolved = resolvedRows(apps, now, config);
  const applied = apps
    .map((app) => ({ app, outcome: applicationOutcome(app, now, config) }))
    .filter((r) => r.app.appliedAt !== null && r.outcome.excludedFromVersions !== "withdrawn");

  const out: SegmentStat[] = [];
  for (const dimension of DIMENSIONS) {
    const levels = new Map<string, { n: number; k: number; effort: number[] }>();
    for (const r of resolved) {
      const level = levelOf(r.app, dimension, terciles);
      if (level === null) continue;
      const cell = levels.get(level) ?? { n: 0, k: 0, effort: [] };
      cell.n += 1;
      if (r.outcome.y === 1) cell.k += 1;
      levels.set(level, cell);
    }
    for (const r of applied) {
      const level = levelOf(r.app, dimension, terciles);
      if (level === null || r.app.effortMinutes === null) continue;
      const cell = levels.get(level) ?? { n: 0, k: 0, effort: [] };
      cell.effort.push(r.app.effortMinutes / 60);
      levels.set(level, cell);
    }
    const keys = [...levels.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const level of keys) {
      const cell = levels.get(level)!;
      const { rate, interval } = shrunkRate(cell.k, cell.n, p0, config.m);
      const meanEffortHours = cell.effort.length ? cell.effort.reduce((a, b) => a + b, 0) / cell.effort.length : null;
      out.push({
        dimension,
        level,
        n: cell.n,
        k: cell.k,
        rate,
        interval,
        small: cell.n < SMALL_CELL,
        meanEffortHours,
        yieldPerHour: yieldPerHour(rate, meanEffortHours),
      });
    }
  }
  return out;
}

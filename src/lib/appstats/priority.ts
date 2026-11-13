import type { StatsConfig } from "./config";
import { DIMENSIONS, levelOf, overallRate, salaryTerciles, segmentStats, type Dimension } from "./segments";
import type { ApplicationInput } from "./types";

/** Damping exponent on each dimension's odds ratio (model section 8). */
export const ODDS_EXPONENT = 0.5;
/** Applied rows with the same ATS needed before their mean effort is used. */
const EFFORT_MIN_ROWS = 3;
/** Hours assumed when no effort has been recorded anywhere. */
const DEFAULT_EFFORT_HOURS = 1;

export interface PriorityScore {
  id: number;
  /** Combined rate from the damped odds product. */
  p: number;
  expectedEffortHours: number;
  score: number;
  contributions: { dimension: Dimension; level: string; rate: number }[];
}

function odds(p: number): number {
  const c = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return c / (1 - c);
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Model section 8: rank saved postings by expected yield per hour.
 * Expected effort is the mean over applied rows with the same ATS when at
 * least EFFORT_MIN_ROWS exist, else over all applied rows, else one hour.
 */
export function priorityScores(
  savedApps: ApplicationInput[],
  appliedApps: ApplicationInput[],
  now: string,
  config: StatsConfig
): PriorityScore[] {
  const { p0 } = overallRate(appliedApps, now, config);
  const segments = segmentStats(appliedApps, now, config);
  const terciles = salaryTerciles(appliedApps);
  const applied = appliedApps.filter((a) => a.appliedAt !== null && a.effortMinutes !== null);
  const overallEffort = mean(applied.map((a) => (a.effortMinutes ?? 0) / 60));

  const out: PriorityScore[] = savedApps.map((app) => {
    let o = odds(p0);
    const contributions: PriorityScore["contributions"] = [];
    for (const dimension of DIMENSIONS) {
      const level = levelOf(app, dimension, terciles);
      if (level === null) continue;
      const seg = segments.find((s) => s.dimension === dimension && s.level === level && s.n > 0);
      if (!seg) continue;
      o *= Math.pow(odds(seg.rate) / odds(p0), ODDS_EXPONENT);
      contributions.push({ dimension, level, rate: seg.rate });
    }
    const p = o / (1 + o);
    const sameAts = applied.filter((a) => app.ats !== null && a.ats === app.ats);
    const effort =
      (sameAts.length >= EFFORT_MIN_ROWS ? mean(sameAts.map((a) => (a.effortMinutes ?? 0) / 60)) : null) ??
      overallEffort ??
      DEFAULT_EFFORT_HOURS;
    const expectedEffortHours = effort > 0 ? effort : DEFAULT_EFFORT_HOURS;
    return { id: app.id, p, expectedEffortHours, score: p / expectedEffortHours, contributions };
  });
  out.sort((a, b) => b.score - a.score || a.id - b.id);
  return out;
}


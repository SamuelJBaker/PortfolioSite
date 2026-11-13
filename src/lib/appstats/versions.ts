import type { StatsConfig } from "./config";
import { applicationOutcome, type ApplicationOutcome } from "./outcomes";
import { betaInterval, betaMean, betaSample, makeRng } from "./rng";
import type { ApplicationInput, ResumeVersionInput } from "./types";

/** Draws for every Monte Carlo P(best) (model section 4). */
export const P_BEST_DRAWS = 20000;
/** Resolved rows before the prior is re-centred on the observed rate (section 4). */
export const RECENTRE_AFTER = 50;
const RETIRE_P = 0.1;
const PROMOTE_P = 0.85;
const DECISION_N = 25;

export interface Prior {
  a0: number;
  b0: number;
  recentred: boolean;
}

export interface VersionStat {
  id: string;
  live: boolean;
  /** Resolved, untailored, non-referral, non-withdrawn rows on this version. */
  n: number;
  k: number;
  mean: number;
  interval: [number, number];
  /** P(best among live versions); null for retired versions or when nothing is live. */
  pBest: number | null;
  /** Rows whose V window has closed (or that have a human visit). */
  nV: number;
  kV: number;
  meanV: number;
  intervalV: [number, number];
  pBestV: number | null;
  retire: boolean;
  promote: boolean;
}

export interface VersionStats {
  versions: VersionStat[];
  prior: Prior;
  resolvedTotal: number;
}

export interface FactorStat {
  factor: string;
  level: string;
  versions: string[];
  n: number;
  k: number;
  mean: number;
  interval: [number, number];
}

/** Rows that enter the version comparison. */
export function versionRows(
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig
): { app: ApplicationInput; outcome: ApplicationOutcome }[] {
  return apps
    .map((app) => ({ app, outcome: applicationOutcome(app, now, config) }))
    .filter((r) => r.app.resumeVersionId !== null && r.outcome.excludedFromVersions === null);
}

/**
 * The Beta prior, re-centred on the observed overall rate once RECENTRE_AFTER
 * rows are resolved, keeping a0 + b0 equal to the configured sum.
 */
export function priorFor(k: number, n: number, config: StatsConfig): Prior {
  if (n < RECENTRE_AFTER) return { a0: config.a0, b0: config.b0, recentred: false };
  const sum = config.a0 + config.b0;
  const rate = Math.min(0.99, Math.max(0.01, k / n));
  return { a0: sum * rate, b0: sum * (1 - rate), recentred: true };
}

/** Share of draws in which each candidate's Beta sample is the largest. */
export function pBestByMonteCarlo(
  candidates: { id: string; a: number; b: number }[],
  seed: number,
  draws = P_BEST_DRAWS
): Map<string, number> {
  const wins = new Map<string, number>(candidates.map((c) => [c.id, 0]));
  if (candidates.length === 0) return wins;
  if (candidates.length === 1) {
    wins.set(candidates[0].id, 1);
    return wins;
  }
  const rng = makeRng(seed);
  for (let d = 0; d < draws; d++) {
    let best = candidates[0].id;
    let bestValue = -1;
    for (const c of candidates) {
      const x = betaSample(rng, c.a, c.b);
      if (x > bestValue) {
        bestValue = x;
        best = c.id;
      }
    }
    wins.set(best, (wins.get(best) ?? 0) + 1);
  }
  for (const [id, w] of wins) wins.set(id, w / draws);
  return wins;
}

function isLive(v: ResumeVersionInput): boolean {
  return v.status === "live" || v.status === "default";
}

export function versionStats(
  versions: ResumeVersionInput[],
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig,
  seed: number
): VersionStats {
  const rows = versionRows(apps, now, config);
  const resolved = rows.filter((r) => r.outcome.resolved && r.outcome.y !== null);
  const resolvedTotal = resolved.length;
  const kTotal = resolved.filter((r) => r.outcome.y === 1).length;
  const prior = priorFor(kTotal, resolvedTotal, config);

  const vRows = rows.filter((r) => r.outcome.v !== null);
  const priorV = priorFor(vRows.filter((r) => r.outcome.v === 1).length, vRows.length, config);

  const counts = versions.map((v) => {
    const mine = resolved.filter((r) => r.app.resumeVersionId === v.id);
    const mineV = vRows.filter((r) => r.app.resumeVersionId === v.id);
    return {
      v,
      n: mine.length,
      k: mine.filter((r) => r.outcome.y === 1).length,
      nV: mineV.length,
      kV: mineV.filter((r) => r.outcome.v === 1).length,
    };
  });

  const live = counts.filter((c) => isLive(c.v));
  const pBest = pBestByMonteCarlo(
    live.map((c) => ({ id: c.v.id, a: prior.a0 + c.k, b: prior.b0 + c.n - c.k })),
    seed
  );
  const pBestV = pBestByMonteCarlo(
    live.map((c) => ({ id: c.v.id, a: priorV.a0 + c.kV, b: priorV.b0 + c.nV - c.kV })),
    seed + 1
  );

  const out: VersionStat[] = counts.map((c) => {
    const a = prior.a0 + c.k;
    const b = prior.b0 + c.n - c.k;
    const aV = priorV.a0 + c.kV;
    const bV = priorV.b0 + c.nV - c.kV;
    const liveFlag = isLive(c.v);
    const p = liveFlag ? (pBest.get(c.v.id) ?? null) : null;
    const pV = liveFlag ? (pBestV.get(c.v.id) ?? null) : null;
    return {
      id: c.v.id,
      live: liveFlag,
      n: c.n,
      k: c.k,
      mean: betaMean(a, b),
      interval: betaInterval(a, b),
      pBest: p,
      nV: c.nV,
      kV: c.kV,
      meanV: betaMean(aV, bV),
      intervalV: betaInterval(aV, bV),
      pBestV: pV,
      retire: liveFlag && p !== null && p < RETIRE_P && c.n >= DECISION_N,
      promote: liveFlag && p !== null && p > PROMOTE_P && c.n >= DECISION_N,
    };
  });

  return { versions: out, prior, resolvedTotal };
}

/** Pooled rates by factor level, once three or more versions have existed (section 4, factor view). */
export function factorStats(
  versions: ResumeVersionInput[],
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig
): FactorStat[] {
  if (versions.length < 3) return [];
  const resolved = versionRows(apps, now, config).filter((r) => r.outcome.resolved && r.outcome.y !== null);
  const prior = priorFor(resolved.filter((r) => r.outcome.y === 1).length, resolved.length, config);

  const groups = new Map<string, { factor: string; level: string; versions: string[] }>();
  for (const v of versions) {
    for (const [factor, level] of Object.entries(v.factors)) {
      const key = `${factor}\u0000${level}`;
      const g = groups.get(key) ?? { factor, level, versions: [] };
      g.versions.push(v.id);
      groups.set(key, g);
    }
  }

  const out: FactorStat[] = [];
  for (const g of groups.values()) {
    const ids = new Set(g.versions);
    const mine = resolved.filter((r) => ids.has(r.app.resumeVersionId ?? ""));
    const n = mine.length;
    const k = mine.filter((r) => r.outcome.y === 1).length;
    const a = prior.a0 + k;
    const b = prior.b0 + n - k;
    out.push({ factor: g.factor, level: g.level, versions: g.versions, n, k, mean: betaMean(a, b), interval: betaInterval(a, b) });
  }
  out.sort((x, y) => x.factor.localeCompare(y.factor) || x.level.localeCompare(y.level));
  return out;
}

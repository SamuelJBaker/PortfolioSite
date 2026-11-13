import type { StatsConfig } from "./config";
import { betaSample, makeRng } from "./rng";
import type { ApplicationInput, ResumeVersionInput } from "./types";
import { priorFor, versionRows } from "./versions";

/** Window of recent random assignments the floor is measured over (model section 4). */
export const FLOOR_WINDOW = 20;

export interface Assignment {
  versionId: string;
  /** The Thompson draw per candidate, also returned when the floor decided. */
  draws: Record<string, number>;
  reason: "draw" | "floor" | "single";
}

/**
 * Thompson sampling within a role family (model section 4).
 *
 * Candidates are the live and default versions. Each candidate's posterior
 * comes from the resolved comparison rows in `roleFamily`; when that family
 * has no resolved rows yet the posterior falls back to all families, so a
 * new family starts from what the versions have shown elsewhere rather than
 * from the bare prior.
 *
 * Floor: over the last FLOOR_WINDOW random assignments (any family), a
 * candidate whose share is under config.floor is assigned next, lowest share
 * first. The floor only applies once at least one random assignment exists;
 * the very first assignment is a draw.
 */
export function assignVersion(
  versions: ResumeVersionInput[],
  roleFamily: string | null,
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig,
  seed: number
): Assignment | null {
  const candidates = versions.filter((v) => v.status === "live" || v.status === "default");
  if (candidates.length === 0) return null;

  const resolvedAll = versionRows(apps, now, config).filter((r) => r.outcome.resolved && r.outcome.y !== null);
  const inFamily = resolvedAll.filter((r) => r.app.roleFamily === roleFamily);
  const pool = inFamily.length > 0 ? inFamily : resolvedAll;
  const prior = priorFor(pool.filter((r) => r.outcome.y === 1).length, pool.length, config);

  const rng = makeRng(seed);
  const draws: Record<string, number> = {};
  for (const c of candidates) {
    const mine = pool.filter((r) => r.app.resumeVersionId === c.id);
    const k = mine.filter((r) => r.outcome.y === 1).length;
    draws[c.id] = betaSample(rng, prior.a0 + k, prior.b0 + mine.length - k);
  }

  if (candidates.length === 1) return { versionId: candidates[0].id, draws, reason: "single" };

  const recent = apps
    .filter((a) => a.assignedBy === "random" && a.resumeVersionId !== null && a.appliedAt !== null)
    .sort((a, b) => Date.parse(b.appliedAt ?? "") - Date.parse(a.appliedAt ?? ""))
    .slice(0, FLOOR_WINDOW);
  if (recent.length > 0) {
    const shares = candidates.map((c) => ({
      id: c.id,
      share: recent.filter((a) => a.resumeVersionId === c.id).length / recent.length,
    }));
    const under = shares.filter((s) => s.share < config.floor).sort((a, b) => a.share - b.share);
    if (under.length > 0) return { versionId: under[0].id, draws, reason: "floor" };
  }

  let best = candidates[0].id;
  for (const c of candidates) if (draws[c.id] > draws[best]) best = c.id;
  return { versionId: best, draws, reason: "draw" };
}

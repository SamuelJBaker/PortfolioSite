import type { StatsConfig } from "./config";
import { applicationOutcome } from "./outcomes";
import { betaInterval } from "./rng";
import type { ApplicationInput } from "./types";

export const FUNNEL_STAGES = ["applied", "human_visit", "response", "interview", "offer"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export interface FunnelRow {
  stage: FunnelStage;
  count: number;
  /** Conversion from the previous stage with a Jeffreys-prior 80 percent interval; null on the first stage or an empty previous stage. */
  fromPrevious: { rate: number; interval: [number, number] } | null;
}

export interface Funnel {
  rows: FunnelRow[];
  /** Applied rows whose Y window is still open; they sit in "applied" only. */
  unresolved: number;
}

/** Model section 10, view 3. human_visit is any human session on the key, not time-boxed. */
export function funnel(apps: ApplicationInput[], now: string, config: StatsConfig): Funnel {
  const applied = apps.filter((a) => a.appliedAt !== null).map((app) => ({ app, outcome: applicationOutcome(app, now, config) }));
  const counts: Record<FunnelStage, number> = {
    applied: applied.length,
    human_visit: applied.filter((r) => r.app.sessions.some((s) => s.cls === "human")).length,
    response: applied.filter((r) => r.outcome.responded).length,
    interview: applied.filter((r) => r.outcome.interview).length,
    offer: applied.filter((r) => r.outcome.offer).length,
  };
  const rows: FunnelRow[] = [];
  let prev: number | null = null;
  for (const stage of FUNNEL_STAGES) {
    const count = counts[stage];
    let fromPrevious: FunnelRow["fromPrevious"] = null;
    if (prev !== null && prev > 0) {
      fromPrevious = { rate: count / prev, interval: betaInterval(count + 0.5, Math.max(0, prev - count) + 0.5) };
    }
    rows.push({ stage, count, fromPrevious });
    prev = count;
  }
  const unresolved = applied.filter((r) => !r.outcome.resolved && r.outcome.excludedFromVersions !== "withdrawn").length;
  return { rows, unresolved };
}

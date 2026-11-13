/**
 * Tunables from stats_config (docs/handoff/APPLICATION-STATS-MODEL.md).
 * Readers pass the latest row per name; nothing in this library reads the
 * database or the clock.
 */
export interface StatsConfig {
  /** Days after applied_at within which a human advance counts as Y = 1 (section 3). */
  tDays: number;
  /** Days after applied_at within which a human visit counts as V = 1 (section 3). */
  vDays: number;
  /** Beta prior for a version's response rate (section 4). */
  a0: number;
  b0: number;
  /** Shrinkage weight for segment rates, in pseudo-applications (section 5). */
  m: number;
  /** Minimum share of the last 20 assignments for a live version (section 4). */
  floor: number;
}

export const DEFAULT_CONFIG: StatsConfig = { tDays: 30, vDays: 14, a0: 0.5, b0: 9.5, m: 10, floor: 0.2 };

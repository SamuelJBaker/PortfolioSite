import { applicationOutcome, type ApplicationInput, type StatsConfig } from "@/lib/appstats";

export const OUTCOME_STATES = ["pending", "human visit", "positive", "rejected", "ghosted", "saved", "withdrawn"] as const;
export type OutcomeState = (typeof OUTCOME_STATES)[number];

/** The one-word state the list shows and filters on. */
export function outcomeState(app: ApplicationInput, now: string, config: StatsConfig): OutcomeState {
  if (app.status === "saved") return "saved";
  if (app.status === "withdrawn") return "withdrawn";
  const o = applicationOutcome(app, now, config);
  if (o.y === 1) return "positive";
  if (o.stage === "rejected") return "rejected";
  if (o.ghosted) return "ghosted";
  if (app.sessions.some((s) => s.cls === "human")) return "human visit";
  return "pending";
}

export const OUTCOME_CLASS: Record<OutcomeState, string> = {
  pending: "text-neutral-400",
  "human visit": "text-accent-text",
  positive: "text-green-400",
  rejected: "text-red-400",
  ghosted: "text-neutral-500",
  saved: "text-neutral-500",
  withdrawn: "text-neutral-500",
};

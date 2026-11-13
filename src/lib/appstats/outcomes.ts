import type { StatsConfig } from "./config";
import { type ApplicationInput, daysBetween, addDays } from "./types";

/** Model section 3, computed from one application's events and sessions. */
export interface ApplicationOutcome {
  /** Primary outcome: 1 for a human advance within tDays, 0 when resolved without one, null while unresolved or excluded. */
  y: 0 | 1 | null;
  resolved: boolean;
  /** Resolved by tDays elapsing with no advance and no rejection. */
  ghosted: boolean;
  /** Secondary outcome: a human visit on the key within vDays; null while the window is open. */
  v: 0 | 1 | null;
  interview: boolean;
  offer: boolean;
  /** Fractional days from applied_at to the first company-originated event. */
  daysToFirstResponse: number | null;
  daysToRejection: number | null;
  responded: boolean;
  /** Fractional days since applied_at, null while saved. */
  ageDays: number | null;
  /** Why the row stays out of the version comparison, null when it counts. */
  excludedFromVersions: null | "tailored" | "referral" | "withdrawn" | "not-applied";
  /** Furthest stage reached; see STAGE_ORDER. */
  stage: Stage;
  /** ISO time the row became resolved (advance, rejection, or applied_at + tDays), null otherwise. */
  resolvedAt: string | null;
  /** ISO time of the advance that set Y = 1. */
  advanceAt: string | null;
  /** ISO time the applicant withdrew, when that happened before resolution. */
  withdrawnAt: string | null;
}

/**
 * Stage order. The pipeline stages rank by how far the application got;
 * "rejected" and "withdrawn" are terminal and override the pipeline stage
 * (a rejection after an interview shows as rejected, with interview = true).
 */
export const STAGE_ORDER = [
  "saved",
  "applied",
  "human_visit",
  "response",
  "assessment",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/** Events the company originates; the first of these is the "first response". */
export const RESPONSE_TYPES = new Set([
  "rejection",
  "recruiter_contact",
  "assessment_invite",
  "phone_screen",
  "interview",
  "offer",
]);

/** Human-initiated advances for Y. An automatic assessment_invite is excluded at the call site. */
const ADVANCE_TYPES = new Set(["recruiter_contact", "phone_screen", "interview", "offer"]);

function isAdvance(type: string, auto: boolean): boolean {
  if (type === "assessment_invite") return !auto;
  return ADVANCE_TYPES.has(type);
}

function earliest(times: string[]): string | null {
  if (times.length === 0) return null;
  return times.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));
}

function notApplied(): ApplicationOutcome {
  return {
    y: null,
    resolved: false,
    ghosted: false,
    v: null,
    interview: false,
    offer: false,
    daysToFirstResponse: null,
    daysToRejection: null,
    responded: false,
    ageDays: null,
    excludedFromVersions: "not-applied",
    stage: "saved",
    resolvedAt: null,
    advanceAt: null,
    withdrawnAt: null,
  };
}

export function applicationOutcome(app: ApplicationInput, now: string, config: StatsConfig): ApplicationOutcome {
  if (!app.appliedAt) return notApplied();
  const appliedAt = app.appliedAt;
  const ageDays = daysBetween(appliedAt, now);
  const events = [...app.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const advanceAt = earliest(
    events.filter((e) => isAdvance(e.type, e.auto) && daysBetween(appliedAt, e.at) <= config.tDays).map((e) => e.at)
  );
  const rejectionAt = earliest(events.filter((e) => e.type === "rejection").map((e) => e.at));
  const deadline = addDays(appliedAt, config.tDays);
  const deadlinePassed = Date.parse(now) >= Date.parse(deadline);

  const candidates: string[] = [];
  if (advanceAt) candidates.push(advanceAt);
  if (rejectionAt) candidates.push(rejectionAt);
  if (deadlinePassed) candidates.push(deadline);
  const resolvedAt = earliest(candidates);

  const withdrawnEvent = earliest(events.filter((e) => e.type === "withdrawn").map((e) => e.at));
  const withdrawnCandidate = withdrawnEvent ?? (app.status === "withdrawn" ? now : null);
  const withdrawnAt =
    withdrawnCandidate !== null && (resolvedAt === null || Date.parse(withdrawnCandidate) < Date.parse(resolvedAt))
      ? withdrawnCandidate
      : null;

  const firstResponseAt = earliest(events.filter((e) => RESPONSE_TYPES.has(e.type)).map((e) => e.at));
  const responded = firstResponseAt !== null;
  const interview = events.some((e) => e.type === "interview");
  const offer = events.some((e) => e.type === "offer");

  const humanVisitAny = app.sessions.some((s) => s.cls === "human");
  const humanVisitInWindow = app.sessions.some(
    (s) => s.cls === "human" && daysBetween(appliedAt, s.at) >= 0 && daysBetween(appliedAt, s.at) <= config.vDays
  );
  let v: 0 | 1 | null = null;
  if (humanVisitInWindow) v = 1;
  else if (ageDays >= config.vDays) v = 0;

  let y: 0 | 1 | null = null;
  let resolved = false;
  let ghosted = false;
  let excludedFromVersions: ApplicationOutcome["excludedFromVersions"] = null;

  if (withdrawnAt !== null) {
    excludedFromVersions = "withdrawn";
  } else {
    if (resolvedAt !== null) {
      resolved = true;
      y = resolvedAt === advanceAt ? 1 : 0;
      ghosted = y === 0 && resolvedAt === deadline && rejectionAt !== resolvedAt;
    }
    if (app.tailored) excludedFromVersions = "tailored";
    else if (app.referral) excludedFromVersions = "referral";
  }

  let stage: Stage = "applied";
  if (withdrawnAt !== null) stage = "withdrawn";
  else if (rejectionAt !== null) stage = "rejected";
  else if (offer) stage = "offer";
  else if (interview) stage = "interview";
  else if (events.some((e) => e.type === "phone_screen")) stage = "phone_screen";
  else if (events.some((e) => e.type === "assessment_invite")) stage = "assessment";
  else if (responded) stage = "response";
  else if (humanVisitAny) stage = "human_visit";

  return {
    y,
    resolved,
    ghosted,
    v,
    interview,
    offer,
    daysToFirstResponse: firstResponseAt ? daysBetween(appliedAt, firstResponseAt) : null,
    daysToRejection: rejectionAt ? daysBetween(appliedAt, rejectionAt) : null,
    responded,
    ageDays,
    excludedFromVersions,
    stage,
    resolvedAt: withdrawnAt !== null ? null : resolvedAt,
    advanceAt: y === 1 ? advanceAt : null,
    withdrawnAt,
  };
}

/** Resolved rows that count toward a rate: applied, resolved, not withdrawn. Tailored and referral rows stay in. */
export function resolvedRows(
  apps: ApplicationInput[],
  now: string,
  config: StatsConfig
): { app: ApplicationInput; outcome: ApplicationOutcome }[] {
  return apps
    .map((app) => ({ app, outcome: applicationOutcome(app, now, config) }))
    .filter((r) => r.outcome.resolved && r.outcome.y !== null);
}

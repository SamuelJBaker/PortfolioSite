/**
 * Database-agnostic inputs. The admin pages adapt D1 rows into these shapes;
 * the library never sees SQL.
 */
export type SessionClass = "bot" | "human" | "unknown";

/** One application_events row; the model's event types except link_visit_*, which come from sessions. */
export interface ApplicationEventInput {
  type: string;
  /** ISO timestamp. */
  at: string;
  /** Automatic assessment invites never count toward Y (section 9). */
  auto: boolean;
}

/** One visitor session on the application's key, already classified. */
export interface SessionInput {
  /** ISO timestamp of the visit_server event. */
  at: string;
  cls: SessionClass;
}

export interface ApplicationInput {
  id: number;
  status: "saved" | "applied" | "withdrawn";
  createdAt: string;
  appliedAt: string | null;
  key: string | null;
  resumeVersionId: string | null;
  assignedBy: "random" | "manual" | null;
  tailored: boolean;
  referral: boolean;
  fit: number | null;
  effortMinutes: number | null;
  coverLetter: string | null;
  company: string;
  companySizeBand: string | null;
  industry: string | null;
  roleTitle: string | null;
  roleFamily: string | null;
  level: string | null;
  location: string | null;
  workMode: string | null;
  ats: string | null;
  sourceChannel: string | null;
  postingAgeDays: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  events: ApplicationEventInput[];
  sessions: SessionInput[];
}

export interface ResumeVersionInput {
  id: string;
  label: string;
  status: "live" | "default" | "retired";
  /** Factor name to level, e.g. { summary: "on", length: "1 page" }. */
  factors: Record<string, string>;
  createdAt: string;
}

const MS_PER_DAY = 86400000;

/** Fractional days from `from` to `to` (ISO strings); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
}

/** ISO timestamp `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * MS_PER_DAY).toISOString();
}

/**
 * Application field vocabularies (model section 2) and the form parsing the
 * admin pages share. Pure; no I/O.
 */

export const ROLE_FAMILIES = ["platform", "ml", "graphics", "general swe", "other"] as const;
export const LEVELS = ["intern", "new grad", "junior", "mid"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const ATS_VALUES = ["greenhouse", "lever", "workday", "ashby", "icims", "taleo", "smartrecruiters", "company-built", "email", "other"] as const;
export const SOURCE_CHANNELS = ["company site", "linkedin", "handshake", "referral", "career fair", "recruiter inbound", "other"] as const;
export const COVER_LETTERS = ["none", "generic", "tailored"] as const;
export const SALARY_PERIODS = ["year", "month", "hour"] as const;
export const COMPANY_SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"] as const;
export const APPLICATION_STATUSES = ["saved", "applied", "withdrawn"] as const;
export const ASSIGNED_BY = ["random", "manual"] as const;
/** Stored event types; link_visit_human and link_visit_bot are derived from sessions. */
export const EVENT_TYPES = ["rejection", "recruiter_contact", "assessment_invite", "phone_screen", "interview", "offer", "withdrawn", "followup_sent"] as const;

export type RoleFamily = (typeof ROLE_FAMILIES)[number];
export type Ats = (typeof ATS_VALUES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

/** Host fragment to ATS, checked in order against the posting URL's host. */
const ATS_HOSTS: Array<[string, Ats]> = [
  ["greenhouse.io", "greenhouse"],
  ["lever.co", "lever"],
  ["myworkdayjobs.com", "workday"],
  ["workday.com", "workday"],
  ["ashbyhq.com", "ashby"],
  ["icims.com", "icims"],
  ["smartrecruiters.com", "smartrecruiters"],
  ["taleo.net", "taleo"],
];

/** The ATS a posting URL implies; "other" for anything unrecognised, null for no URL. */
export function atsFromUrl(url: string): Ats | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let host: string;
  try {
    host = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return "other";
  }
  for (const [fragment, ats] of ATS_HOSTS) {
    if (host === fragment || host.endsWith(`.${fragment}`)) return ats;
  }
  return "other";
}

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
export const KEY_LENGTH = 8;
export const KEY_PATTERN = /^[a-z2-7]{8}$/;

/** 8 random lowercase base32 characters (40 bits). */
export function generateKey(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(KEY_LENGTH));
  let out = "";
  for (let i = 0; i < KEY_LENGTH; i++) out += KEY_ALPHABET[bytes[i] % 32];
  return out;
}

/** The posting and submission fields a form carries (everything but id, status, key, applied_at, version, assigned_by). */
export interface ApplicationFields {
  company: string;
  company_size_band: string | null;
  industry: string | null;
  role_title: string | null;
  role_family: string | null;
  level: string | null;
  location: string | null;
  work_mode: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  benefits: string | null;
  ats: string | null;
  source_channel: string | null;
  posted_at: string | null;
  posting_age_days: number | null;
  applicant_count: number | null;
  requisition_id: string | null;
  posting_url: string | null;
  referral: number;
  cover_letter: string | null;
  tailored: number;
  fit: number | null;
  effort_minutes: number | null;
}

export type FieldErrors = Partial<Record<keyof ApplicationFields | "form", string>>;

function str(fd: FormData, name: string, max = 300): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

function num(fd: FormData, name: string, errors: FieldErrors, opts: { int?: boolean; min?: number; max?: number } = {}): number | null {
  const raw = str(fd, name, 40);
  if (raw === null) return null;
  const n = Number(raw.replace(/[,$_\s]/g, ""));
  if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n)) || (opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max)) {
    errors[name as keyof ApplicationFields] = `Must be a number${opts.int ? " (whole)" : ""}${opts.min !== undefined ? ` from ${opts.min}` : ""}${opts.max !== undefined ? ` to ${opts.max}` : ""}.`;
    return null;
  }
  return n;
}

function oneOf(fd: FormData, name: string, values: readonly string[], errors: FieldErrors): string | null {
  const v = str(fd, name, 60);
  if (v === null) return null;
  if (!values.includes(v)) {
    errors[name as keyof ApplicationFields] = "Invalid choice.";
    return null;
  }
  return v;
}

function isoDate(fd: FormData, name: string, errors: FieldErrors): string | null {
  const v = str(fd, name, 40);
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(v) || Number.isNaN(Date.parse(v))) {
    errors[name as keyof ApplicationFields] = "Use YYYY-MM-DD.";
    return null;
  }
  return v.length === 10 ? `${v}T00:00:00.000Z` : new Date(v).toISOString();
}

/** Whole days between a posting date and now; null without a date. */
export function postingAgeDays(postedAt: string | null, now: Date): number | null {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

/** Parse the shared fields; `errors` is empty when everything is valid. */
export function parseApplicationFields(fd: FormData, now = new Date()): { fields: ApplicationFields; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const company = str(fd, "company", 200);
  if (!company) errors.company = "Company is required.";

  const posting_url = str(fd, "posting_url", 2048);
  if (posting_url && !/^https?:\/\//i.test(posting_url)) errors.posting_url = "Must start with http:// or https://.";

  const posted_at = isoDate(fd, "posted_at", errors);
  const explicitAge = num(fd, "posting_age_days", errors, { int: true, min: 0 });

  const fields: ApplicationFields = {
    company: company ?? "",
    company_size_band: oneOf(fd, "company_size_band", COMPANY_SIZE_BANDS, errors),
    industry: str(fd, "industry", 120),
    role_title: str(fd, "role_title", 200),
    role_family: oneOf(fd, "role_family", ROLE_FAMILIES, errors),
    level: oneOf(fd, "level", LEVELS, errors),
    location: str(fd, "location", 200),
    work_mode: oneOf(fd, "work_mode", WORK_MODES, errors),
    salary_min: num(fd, "salary_min", errors, { min: 0 }),
    salary_max: num(fd, "salary_max", errors, { min: 0 }),
    salary_period: oneOf(fd, "salary_period", SALARY_PERIODS, errors),
    benefits: str(fd, "benefits", 500),
    ats: oneOf(fd, "ats", ATS_VALUES, errors),
    source_channel: oneOf(fd, "source_channel", SOURCE_CHANNELS, errors),
    posted_at,
    posting_age_days: explicitAge ?? postingAgeDays(posted_at, now),
    applicant_count: num(fd, "applicant_count", errors, { int: true, min: 0 }),
    requisition_id: str(fd, "requisition_id", 120),
    posting_url,
    referral: fd.get("referral") ? 1 : 0,
    cover_letter: oneOf(fd, "cover_letter", COVER_LETTERS, errors),
    tailored: fd.get("tailored") ? 1 : 0,
    fit: num(fd, "fit", errors, { int: true, min: 1, max: 5 }),
    effort_minutes: num(fd, "effort_minutes", errors, { int: true, min: 0 }),
  };
  if (fields.salary_min !== null && fields.salary_max !== null && fields.salary_min > fields.salary_max) {
    errors.salary_max = "Max is below min.";
  }
  return { fields, errors };
}

/** The extra requirements for Apply (model: fit entered before submitting). */
export function applyErrors(fields: ApplicationFields): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.fit === null) errors.fit = "Fit (1 to 5) is required to apply.";
  if (fields.effort_minutes === null) errors.effort_minutes = "Effort minutes are required to apply.";
  return errors;
}

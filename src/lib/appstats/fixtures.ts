import type { ApplicationInput, ResumeVersionInput } from "./types";

/** Test helpers; not part of the public API. */
export const NOW = "2026-11-13T12:00:00.000Z";

let nextId = 1;

export function resetIds(): void {
  nextId = 1;
}

export function mkApp(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  const id = overrides.id ?? nextId++;
  return {
    id,
    status: "applied",
    createdAt: "2026-10-01T00:00:00.000Z",
    appliedAt: "2026-10-01T00:00:00.000Z",
    key: `k${id}`,
    resumeVersionId: "v1",
    assignedBy: "random",
    tailored: false,
    referral: false,
    fit: 3,
    effortMinutes: 60,
    coverLetter: "none",
    company: "Acme",
    companySizeBand: null,
    industry: null,
    roleTitle: null,
    roleFamily: "platform",
    level: null,
    location: null,
    workMode: null,
    ats: "greenhouse",
    sourceChannel: null,
    postingAgeDays: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    events: [],
    sessions: [],
    ...overrides,
  };
}

export function mkVersion(id: string, overrides: Partial<ResumeVersionInput> = {}): ResumeVersionInput {
  return { id, label: id, status: "live", factors: {}, createdAt: "2026-09-01T00:00:00.000Z", ...overrides };
}

/** n applications on a version, the first k with a recruiter_contact on day 5, the rest ghosted (applied 40 days ago). */
export function resolvedBatch(versionId: string, n: number, k: number, extra: Partial<ApplicationInput> = {}): ApplicationInput[] {
  const out: ApplicationInput[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      mkApp({
        resumeVersionId: versionId,
        appliedAt: "2026-10-01T00:00:00.000Z",
        events: i < k ? [{ type: "recruiter_contact", at: "2026-10-06T00:00:00.000Z", auto: false }] : [],
        ...extra,
      })
    );
  }
  return out;
}

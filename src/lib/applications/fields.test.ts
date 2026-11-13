import { describe, expect, it } from "vitest";
import { applyErrors, atsFromUrl, generateKey, KEY_PATTERN, parseApplicationFields, postingAgeDays } from "./fields";

describe("atsFromUrl", () => {
  it("maps known hosts and falls back to other", () => {
    expect(atsFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse");
    expect(atsFromUrl("https://jobs.lever.co/acme/abc")).toBe("lever");
    expect(atsFromUrl("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x")).toBe("workday");
    expect(atsFromUrl("https://jobs.ashbyhq.com/acme/1")).toBe("ashby");
    expect(atsFromUrl("https://careers-acme.icims.com/jobs/1")).toBe("icims");
    expect(atsFromUrl("https://jobs.smartrecruiters.com/Acme/1")).toBe("smartrecruiters");
    expect(atsFromUrl("https://acme.taleo.net/careersection/1")).toBe("taleo");
    expect(atsFromUrl("https://acme.com/careers/1")).toBe("other");
    expect(atsFromUrl("acme.com/careers")).toBe("other");
    expect(atsFromUrl("   ")).toBeNull();
  });
});

describe("generateKey", () => {
  it("is 8 lowercase base32 characters and uses every byte", () => {
    const k = generateKey();
    expect(k).toMatch(KEY_PATTERN);
    expect(generateKey(() => new Uint8Array([0, 1, 25, 26, 31, 32, 33, 255]))).toBe("abz27ab7");
  });
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("parseApplicationFields", () => {
  const now = new Date("2026-11-13T12:00:00Z");

  it("requires a company and validates choices and numbers", () => {
    const { errors } = parseApplicationFields(fd({ ats: "nope", fit: "9", salary_min: "100", salary_max: "50", posting_url: "ftp://x" }), now);
    expect(errors.company).toMatch(/required/);
    expect(errors.ats).toBe("Invalid choice.");
    expect(errors.fit).toMatch(/from 1 to 5/);
    expect(errors.salary_max).toBe("Max is below min.");
    expect(errors.posting_url).toMatch(/http/);
  });

  it("parses a full row, deriving posting age from the date", () => {
    const { fields, errors } = parseApplicationFields(
      fd({
        company: "Acme", role_title: "SWE", role_family: "platform", level: "new grad", work_mode: "remote", ats: "greenhouse",
        source_channel: "linkedin", posted_at: "2026-11-03", salary_min: "120,000", salary_max: "150000", salary_period: "year",
        fit: "4", effort_minutes: "45", referral: "on", cover_letter: "none", posting_url: "https://boards.greenhouse.io/acme/1",
      }),
      now
    );
    expect(errors).toEqual({});
    expect(fields.posting_age_days).toBe(10);
    expect(fields.salary_min).toBe(120000);
    expect(fields.referral).toBe(1);
    expect(fields.tailored).toBe(0);
    expect(fields.fit).toBe(4);
    expect(postingAgeDays(null, now)).toBeNull();
  });

  it("apply needs fit and effort", () => {
    const { fields } = parseApplicationFields(fd({ company: "Acme" }), now);
    expect(Object.keys(applyErrors(fields)).sort()).toEqual(["effort_minutes", "fit"]);
    const ok = parseApplicationFields(fd({ company: "Acme", fit: "3", effort_minutes: "20" }), now).fields;
    expect(applyErrors(ok)).toEqual({});
  });
});

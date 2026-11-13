import { describe, expect, it } from "vitest";
import { applicationsCsv, csvCell, csvLine } from "./csv";
import type { ApplicationEventRow, ApplicationRow } from "./store";

describe("csv", () => {
  it("quotes only what needs quoting", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", now')).toBe('"say ""hi"", now"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvLine([1, "a,b", null])).toBe('1,"a,b",');
  });

  it("writes both tables with headers", () => {
    const row = {
      id: 1, key: "abc", status: "applied", created_at: "2026-11-01T00:00:00.000Z", applied_at: "2026-11-02T00:00:00.000Z",
      resume_version_id: "v1", assigned_by: "random", company: "Acme, Inc", company_size_band: null, industry: null, role_title: "SWE",
      role_family: "platform", level: "new grad", location: null, work_mode: "remote", salary_min: null, salary_max: null, salary_period: null,
      benefits: null, ats: "greenhouse", source_channel: "linkedin", posted_at: null, posting_age_days: 3, applicant_count: null,
      requisition_id: null, posting_url: null, referral: 0, cover_letter: "none", tailored: 0, fit: 4, effort_minutes: 30,
    } as ApplicationRow;
    const ev: ApplicationEventRow = { id: 7, application_id: 1, type: "rejection", at: "2026-11-10T00:00:00.000Z", auto: 0, note: null };
    const csv = applicationsCsv([row], [ev]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("# applications");
    expect(lines[1]).toMatch(/^id,key,status,created_at,applied_at,resume_version_id,assigned_by,company,/);
    expect(lines[2]).toMatch(/^1,abc,applied,2026-11-01T00:00:00.000Z,2026-11-02T00:00:00.000Z,v1,random,"Acme, Inc",,,SWE,platform/);
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("# application_events");
    expect(lines[5]).toBe("id,application_id,type,at,auto,note");
    expect(lines[6]).toBe("7,1,rejection,2026-11-10T00:00:00.000Z,0,");
  });
});

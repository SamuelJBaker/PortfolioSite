import { describe, expect, it } from "vitest";
import { isBeaconEvent, isValidSessionId, normalizePayload, resolveEventKey, type SessionLookup } from "./beacon";

function lookup(rows: Record<string, { key: string | null }>): SessionLookup & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async visitServerRow(sessionId) {
      calls.push(sessionId);
      return rows[sessionId] ?? null;
    },
  };
}

describe("resolveEventKey", () => {
  it("uses the visit_server row's key and ignores body and Referer keys", async () => {
    const l = lookup({ s1: { key: "acme-swe" } });
    expect(await resolveEventKey(l, "s1", "forged-key", "other-key")).toBe("acme-swe");
    expect(l.calls).toEqual(["s1"]);
  });

  it("is null when the visit_server row has no key (unknown key at /v/)", async () => {
    const l = lookup({ s2: { key: null } });
    expect(await resolveEventKey(l, "s2", "forged-key")).toBeNull();
  });

  it("is null when the session never went through /v/[key], whatever the client sent", async () => {
    const l = lookup({});
    expect(await resolveEventKey(l, "fresh", "forged-key", "forged-key")).toBeNull();
  });
});

describe("validation", () => {
  it("accepts the funnel event names and rejects others", () => {
    for (const e of ["visit_confirmed", "section_view", "resume_open", "resume_download", "project_click", "outbound_click", "engaged", "dwell"]) {
      expect(isBeaconEvent(e)).toBe(true);
    }
    expect(isBeaconEvent("drop table")).toBe(false);
    expect(isBeaconEvent(3)).toBe(false);
  });

  it("bounds the session id and payload", () => {
    expect(isValidSessionId("a".repeat(64))).toBe(true);
    expect(isValidSessionId("a".repeat(65))).toBe(false);
    expect(isValidSessionId("")).toBe(false);
    expect(normalizePayload({ visible_ms: 5000, max_scroll_pct: 40 })).toBe('{"visible_ms":5000,"max_scroll_pct":40}');
    expect(normalizePayload("x")).toBeNull();
    expect(normalizePayload([1])).toBeNull();
    expect(normalizePayload({ big: "x".repeat(2000) })).toBeNull();
  });
});

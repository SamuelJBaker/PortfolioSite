import { describe, expect, it } from "vitest";
import { isBotUserAgent } from "./bots";
import { classifySession, classifySessions, type SessionEventRow } from "./classify";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function visit(over: Partial<SessionEventRow> = {}): SessionEventRow {
  return { event: "visit_server", ua: CHROME, cf_threat_score: 0, has_js: 1, payload: null, ...over };
}

describe("isBotUserAgent", () => {
  it("matches the listed fragments case-insensitively", () => {
    expect(isBotUserAgent("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
    expect(isBotUserAgent("curl/8.5.0")).toBe(true);
    expect(isBotUserAgent("python-requests/2.32")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 ... HeadlessChrome/130.0")).toBe(true);
    expect(isBotUserAgent("MIMECAST link scanner")).toBe(true);
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
  });
});

describe("classifySession", () => {
  it("bot on a listed user agent even with JS events", () => {
    expect(classifySession([visit({ ua: "LinkedInBot/1.0" }), { event: "visit_confirmed", has_js: 1 }, { event: "engaged", has_js: 1 }])).toBe("bot");
  });

  it("bot with no JS and a threat score over 30; not with JS; not at exactly 30", () => {
    expect(classifySession([visit({ cf_threat_score: 31, has_js: 0 })])).toBe("bot");
    expect(classifySession([visit({ cf_threat_score: 30, has_js: 0 })])).toBe("unknown");
    expect(classifySession([visit({ cf_threat_score: 80, has_js: 0 }), { event: "visit_confirmed", has_js: 1 }])).toBe("unknown");
  });

  it("human on an engaged event", () => {
    expect(classifySession([visit(), { event: "visit_confirmed", has_js: 1 }, { event: "engaged", has_js: 1 }])).toBe("human");
  });

  it("human on a 5 s dwell plus activity; unknown without the activity or with a short dwell", () => {
    const dwell = (ms: number): SessionEventRow => ({ event: "dwell", has_js: 1, payload: JSON.stringify({ visible_ms: ms, max_scroll_pct: 10 }) });
    const view: SessionEventRow = { event: "section_view", has_js: 1, payload: '{"section":"projects"}' };
    expect(classifySession([visit(), dwell(5000), view])).toBe("human");
    expect(classifySession([visit(), dwell(4999), view])).toBe("unknown");
    expect(classifySession([visit(), dwell(60000)])).toBe("unknown");
    expect(classifySession([visit(), { event: "resume_download", has_js: 1 }, { event: "dwell", has_js: 1, payload: { visible_ms: 9000 } }])).toBe("human");
  });

  it("unknown for a bare visit, a JS-only visit, or a session with no visit row", () => {
    expect(classifySession([visit({ has_js: 0 })])).toBe("unknown");
    expect(classifySession([visit(), { event: "visit_confirmed", has_js: 1 }])).toBe("unknown");
    expect(classifySession([{ event: "visit_confirmed", has_js: 1 }])).toBe("unknown");
    expect(classifySession([])).toBe("unknown");
  });

  it("groups rows by session", () => {
    const rows = [
      { session_id: "a", ...visit({ ua: "curl/8.0", has_js: 0 }) },
      { session_id: "b", ...visit() },
      { session_id: "b", event: "engaged", has_js: 1 },
    ];
    const m = classifySessions(rows);
    expect(m.get("a")).toBe("bot");
    expect(m.get("b")).toBe("human");
  });
});

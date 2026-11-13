import { describe, expect, it } from "vitest";
import { dailySalt, firstOpen, hashIp, saltKey, type VisitKv } from "./visit";

class FakeKv implements VisitKv {
  store = new Map<string, string>();
  gets: string[] = [];
  puts: Array<{ key: string; value: string; ttl?: number }> = [];
  async get(key: string) {
    this.gets.push(key);
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.puts.push({ key, value, ttl: options?.expirationTtl });
    this.store.set(key, value);
  }
}

const NOW = new Date("2026-11-13T10:00:00Z");

describe("hashIp", () => {
  it("is 32 lowercase hex characters and depends on the salt", async () => {
    const a = await hashIp("203.0.113.7", "salt-one");
    const b = await hashIp("203.0.113.7", "salt-two");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
    expect(await hashIp("203.0.113.7", "salt-one")).toBe(a);
  });
});

describe("dailySalt", () => {
  it("creates the salt once per UTC day with a 48 h TTL and reuses it", async () => {
    const kv = new FakeKv();
    const first = await dailySalt(kv, NOW);
    const second = await dailySalt(kv, new Date("2026-11-13T23:59:59Z"));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(kv.puts).toEqual([{ key: "salt:2026-11-13", value: first, ttl: 48 * 3600 }]);
    expect(kv.gets).toEqual(["salt:2026-11-13", "salt:2026-11-13"]);
  });

  it("uses a new salt on the next day", async () => {
    const kv = new FakeKv();
    const today = await dailySalt(kv, NOW);
    const tomorrow = await dailySalt(kv, new Date("2026-11-14T00:00:01Z"));
    expect(tomorrow).not.toBe(today);
    expect(saltKey(new Date("2026-11-14T00:00:01Z"))).toBe("salt:2026-11-14");
  });
});

describe("firstOpen", () => {
  it("flags the first open, then a repeat from the same IP the same day", async () => {
    const kv = new FakeKv();
    const a = await firstOpen(kv, true, "acme-swe", "203.0.113.7", NOW);
    const b = await firstOpen(kv, true, "acme-swe", "203.0.113.7", NOW);
    const c = await firstOpen(kv, true, "acme-swe", "198.51.100.2", NOW);
    expect(a.isFirstOpen).toBe(true);
    expect(b.isFirstOpen).toBe(false);
    expect(c.isFirstOpen).toBe(true);
    const dedupe = kv.puts.filter((p) => p.key.startsWith("visit:"));
    expect(dedupe).toHaveLength(2);
    expect(dedupe[0].key).toMatch(/^visit:acme-swe:[0-9a-f]{32}$/);
    expect(dedupe[0].ttl).toBe(24 * 3600);
  });

  it("makes no KV call at all for an unknown or inactive key", async () => {
    const kv = new FakeKv();
    const r = await firstOpen(kv, false, "nope", "203.0.113.7", NOW);
    expect(r.isFirstOpen).toBeNull();
    expect(kv.gets).toEqual([]);
    expect(kv.puts).toEqual([]);
  });
});

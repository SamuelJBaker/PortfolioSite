import { describe, expect, it } from "vitest";
import { cached, type CacheKv } from "./cache";

function memoryKv(): CacheKv & { store: Map<string, { value: string; ttl?: number }> } {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    async get(key) {
      return store.get(key)?.value ?? null;
    },
    async put(key, value, options) {
      store.set(key, { value, ttl: options?.expirationTtl });
    },
  };
}

function clock(start: number) {
  let t = start;
  return { now: () => t, advance: (sec: number) => (t += sec * 1000) };
}

const base = { key: "t:v1", freshSec: 600, staleSec: 86400, fallback: { ok: false } as { ok: boolean; n?: number } };

describe("cached", () => {
  it("awaits load() on a miss and stores { data, fetchedAt } with the stale TTL", async () => {
    const kv = memoryKv();
    const c = clock(1_000_000);
    const pending: Promise<unknown>[] = [];
    const r = await cached({ ...base, kv, now: c.now, waitUntil: (p) => pending.push(p), load: async () => ({ ok: true, n: 1 }) });
    expect(r).toEqual({ data: { ok: true, n: 1 }, stale: false, source: "fresh", fetchedAt: 1_000_000 });
    const stored = kv.store.get("t:v1")!;
    expect(JSON.parse(stored.value)).toEqual({ data: { ok: true, n: 1 }, fetchedAt: 1_000_000 });
    expect(stored.ttl).toBe(86400);
    expect(pending).toHaveLength(0);
  });

  it("serves a fresh entry without calling load()", async () => {
    const kv = memoryKv();
    const c = clock(1_000_000);
    let calls = 0;
    const load = async () => ({ ok: true, n: ++calls });
    await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load });
    c.advance(599);
    const r = await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load });
    expect(r.source).toBe("fresh");
    expect(r.data).toEqual({ ok: true, n: 1 });
    expect(calls).toBe(1);
  });

  it("serves a stale entry at once and refreshes through waitUntil", async () => {
    const kv = memoryKv();
    const c = clock(1_000_000);
    let calls = 0;
    const load = async () => ({ ok: true, n: ++calls });
    await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load });
    c.advance(601);
    const pending: Promise<unknown>[] = [];
    const r = await cached({ ...base, kv, now: c.now, waitUntil: (p) => pending.push(p), load });
    expect(r).toMatchObject({ data: { ok: true, n: 1 }, stale: true, source: "stale" });
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(JSON.parse(kv.store.get("t:v1")!.value)).toEqual({ data: { ok: true, n: 2 }, fetchedAt: c.now() });
  });

  it("a failed background refresh keeps the stale entry and does not reject", async () => {
    const kv = memoryKv();
    const c = clock(1_000_000);
    await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load: async () => ({ ok: true, n: 1 }) });
    c.advance(601);
    const pending: Promise<unknown>[] = [];
    await cached({ ...base, kv, now: c.now, waitUntil: (p) => pending.push(p), load: async () => { throw new Error("429"); } });
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(JSON.parse(kv.store.get("t:v1")!.value).data).toEqual({ ok: true, n: 1 });
  });

  it("serves the expired entry when load() fails past staleSec", async () => {
    const kv = memoryKv();
    const c = clock(1_000_000);
    await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load: async () => ({ ok: true, n: 1 }) });
    c.advance(86401);
    const r = await cached({ ...base, kv, now: c.now, waitUntil: () => {}, load: async () => { throw new Error("down"); } });
    expect(r).toMatchObject({ data: { ok: true, n: 1 }, stale: true, source: "stale" });
  });

  it("returns the typed fallback when nothing is cached and load() fails", async () => {
    const kv = memoryKv();
    const r = await cached({ ...base, kv, waitUntil: () => {}, load: async () => { throw new Error("down"); } });
    expect(r).toEqual({ data: { ok: false }, stale: true, source: "fallback", fetchedAt: null });
    expect(kv.store.size).toBe(0);
  });

  it("treats a corrupt entry as a miss", async () => {
    const kv = memoryKv();
    kv.store.set("t:v1", { value: "not json" });
    const r = await cached({ ...base, kv, waitUntil: () => {}, load: async () => ({ ok: true, n: 7 }) });
    expect(r.data).toEqual({ ok: true, n: 7 });
  });

  it("clamps the KV TTL to the 60 s minimum", async () => {
    const kv = memoryKv();
    await cached({ ...base, staleSec: 5, kv, waitUntil: () => {}, load: async () => ({ ok: true }) });
    expect(kv.store.get("t:v1")!.ttl).toBe(60);
  });
});

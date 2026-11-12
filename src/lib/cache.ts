/**
 * KV get-or-refresh helper for the external-API routes (chess, later decks).
 *
 * Stored value: { data, fetchedAt } with expirationTtl = staleSec. Fresh
 * entries return as they are; stale ones return at once and refresh in the
 * background through waitUntil; a missing entry awaits load(). When load()
 * fails, the stale entry is served if there is one, else the typed fallback.
 * Never throws.
 */

/** The subset of KVNamespace this helper needs; tests pass an in-memory stub. */
export interface CacheKv {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface CacheEntry<T> {
  data: T;
  /** Unix ms. */
  fetchedAt: number;
}

export type CacheSource = "fresh" | "stale" | "fallback";

export interface CachedResult<T> {
  data: T;
  /** True unless the data came straight from a fresh entry or a successful load. */
  stale: boolean;
  source: CacheSource;
  fetchedAt: number | null;
}

export interface CachedOptions<T> {
  kv: CacheKv;
  /** Versioned, e.g. "chess:summary:v1". */
  key: string;
  /** Serve without refresh. */
  freshSec: number;
  /** Serve stale and refresh in waitUntil; also the KV TTL. */
  staleSec: number;
  load: () => Promise<T>;
  waitUntil: (p: Promise<unknown>) => void;
  /** Returned when nothing is cached and load() fails. */
  fallback: T;
  /** Unix ms clock, for tests. */
  now?: () => number;
}

const KV_MIN_TTL_SEC = 60;

async function readEntry<T>(kv: CacheKv, key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await kv.get(key, "text");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEntry<T>>;
    if (typeof parsed.fetchedAt !== "number" || !("data" in parsed)) return null;
    return parsed as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function writeEntry<T>(kv: CacheKv, key: string, data: T, fetchedAt: number, staleSec: number) {
  const entry: CacheEntry<T> = { data, fetchedAt };
  await kv.put(key, JSON.stringify(entry), { expirationTtl: Math.max(staleSec, KV_MIN_TTL_SEC) });
}

export async function cached<T>(opts: CachedOptions<T>): Promise<CachedResult<T>> {
  const now = opts.now ?? Date.now;
  const entry = await readEntry<T>(opts.kv, opts.key);
  const ageSec = entry ? (now() - entry.fetchedAt) / 1000 : Infinity;

  if (entry && ageSec < opts.freshSec) {
    return { data: entry.data, stale: false, source: "fresh", fetchedAt: entry.fetchedAt };
  }

  const refresh = async (): Promise<T> => {
    const data = await opts.load();
    await writeEntry(opts.kv, opts.key, data, now(), opts.staleSec);
    return data;
  };

  if (entry && ageSec < opts.staleSec) {
    opts.waitUntil(refresh().catch(() => undefined));
    return { data: entry.data, stale: true, source: "stale", fetchedAt: entry.fetchedAt };
  }

  try {
    const data = await refresh();
    return { data, stale: false, source: "fresh", fetchedAt: now() };
  } catch {
    if (entry) return { data: entry.data, stale: true, source: "stale", fetchedAt: entry.fetchedAt };
    return { data: opts.fallback, stale: true, source: "fallback", fetchedAt: null };
  }
}

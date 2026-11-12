import type { CacheKv } from "./cache";

/**
 * Outbound JSON fetch for third-party APIs: identifying User-Agent, Accept,
 * a hard timeout, and optional ETag revalidation through KV.
 *
 * With `kv` and `etagKey`, the last ETag and body for the URL are stored under
 * `etagKey`, `If-None-Match` is sent, and a 304 returns the stored body with
 * `notModified: true`. 429 and other non-2xx statuses throw UpstreamError so
 * callers fall back to stale data.
 */

export const USER_AGENT = "samueljbaker.dev (contact: samuel.j.baker908@gmail.com)";

const DEFAULT_TIMEOUT_MS = 8_000;
const ETAG_TTL_SEC = 7 * 24 * 3600;

export class UpstreamError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number
  ) {
    super(`Upstream ${status} for ${url}`);
    this.name = "UpstreamError";
  }
}

export interface FetchJsonOptions {
  kv?: CacheKv;
  /** KV key for this URL's ETag and body, e.g. "etag:chess:stats". */
  etagKey?: string;
  timeoutMs?: number;
}

export interface FetchJsonResult<T> {
  data: T;
  status: number;
  notModified: boolean;
  etag: string | null;
}

interface EtagEntry {
  etag: string;
  body: string;
}

async function readEtag(kv: CacheKv, key: string): Promise<EtagEntry | null> {
  try {
    const raw = await kv.get(key, "text");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EtagEntry>;
    return typeof parsed.etag === "string" && typeof parsed.body === "string" ? (parsed as EtagEntry) : null;
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<FetchJsonResult<T>> {
  const useEtag = !!(opts.kv && opts.etagKey);
  const stored = useEtag ? await readEtag(opts.kv!, opts.etagKey!) : null;

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (stored) headers["If-None-Match"] = stored.etag;

  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (res.status === 304 && stored) {
    return { data: JSON.parse(stored.body) as T, status: 304, notModified: true, etag: stored.etag };
  }

  if (!res.ok) throw new UpstreamError(url, res.status);

  const body = await res.text();
  const etag = res.headers.get("etag");
  if (useEtag && etag) {
    const entry: EtagEntry = { etag, body };
    opts.kv!.put(opts.etagKey!, JSON.stringify(entry), { expirationTtl: ETAG_TTL_SEC }).catch(() => undefined);
  }

  return { data: JSON.parse(body) as T, status: res.status, notModified: false, etag };
}

/** Sleep helper for serial upstream walks. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

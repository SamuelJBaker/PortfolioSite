/**
 * /v/[key] visit helpers: the daily-salted IP hash and the first-open
 * dedupe. Pure over a minimal KV interface so the route stays thin and the
 * behaviour is testable without a Worker.
 *
 * F36: the hash is an HMAC-SHA-256 keyed by a salt that rotates each UTC
 * day, kept at 32 hex characters (128 bits), so distinct visitors do not
 * collide and the stored value is useless outside that day.
 * F37: the dedupe entry is only touched for a valid, active key.
 */

export interface VisitKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** The salt key for a UTC date; the salt outlives its day by 24 h so a hash never fails at midnight. */
export const SALT_TTL_SEC = 48 * 60 * 60;
export const DEDUPE_TTL_SEC = 24 * 60 * 60;
export const HASH_HEX_LENGTH = 32;

export function saltKey(now: Date): string {
  return `salt:${now.toISOString().slice(0, 10)}`;
}

export function dedupeKey(key: string, ipHash: string): string {
  return `visit:${key}:${ipHash}`;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Today's salt: 32 random bytes as hex, created on first use that day. */
export async function dailySalt(kv: VisitKv, now: Date): Promise<string> {
  const key = saltKey(now);
  const existing = await kv.get(key);
  if (existing) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const salt = toHex(bytes);
  await kv.put(key, salt, { expirationTtl: SALT_TTL_SEC });
  return salt;
}

/** HMAC-SHA-256(salt, ip), first 32 hex characters. Never stores or returns the raw IP. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(ip));
  return toHex(new Uint8Array(mac)).slice(0, HASH_HEX_LENGTH);
}

export interface FirstOpenResult {
  /** true on the first open of this key from this hashed IP today, false on a repeat, null when the key is not valid. */
  isFirstOpen: boolean | null;
}

/**
 * First-open detection for a valid key. For an invalid key nothing is read
 * or written (no salt, no hash, no dedupe entry) and isFirstOpen is null.
 */
export async function firstOpen(kv: VisitKv, validKey: boolean, key: string, ip: string, now: Date): Promise<FirstOpenResult> {
  if (!validKey) return { isFirstOpen: null };
  const salt = await dailySalt(kv, now);
  const ipHash = await hashIp(ip, salt);
  const entry = dedupeKey(key, ipHash);
  const seen = await kv.get(entry);
  if (seen !== null) return { isFirstOpen: false };
  await kv.put(entry, now.toISOString(), { expirationTtl: DEDUPE_TTL_SEC });
  return { isFirstOpen: true };
}

// Subpath imports keep the JWE/deflate code (unsupported on the edge runtime) out of the middleware bundle.
import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";

/**
 * Cloudflare Access identity for the admin surface.
 *
 * Access runs at the edge and attaches a signed JWT to every request that
 * passed its policy, as the Cf-Access-Jwt-Assertion header and as the
 * CF_Authorization cookie. The worker re-verifies that token against the
 * team's JWKS so a request that bypasses Access (direct worker URL, a stale
 * route, a misconfigured policy) is still rejected.
 */

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export interface AccessIdentity {
  email: string;
}

const JWT_HEADER = "cf-access-jwt-assertion";
const JWT_COOKIE = "CF_Authorization";

/** JWKS fetcher per team domain, cached for the life of the isolate. */
const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(teamDomain: string) {
  let jwks = jwksByDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksByDomain.set(teamDomain, jwks);
  }
  return jwks;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

/** The raw Access token on a request, header first, then cookie. */
export function readAccessToken(request: Request): string | null {
  return request.headers.get(JWT_HEADER) || readCookie(request.headers.get("cookie"), JWT_COOKIE);
}

/** Public Access settings from wrangler vars. Both are required to verify. */
export function getAccessConfig(env: AccessEnv): { teamDomain: string; aud: string } | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!teamDomain || !aud) return null;
  return { teamDomain, aud };
}

/** Logout URL on the team domain; clears the Access session for every app. */
export function accessLogoutUrl(env: AccessEnv): string {
  const teamDomain = env.ACCESS_TEAM_DOMAIN ?? "";
  return `https://${teamDomain}/cdn-cgi/access/logout`;
}

/**
 * Verify the Access JWT on `request`. Returns the identity or null.
 *
 * Local development only: `next dev` has no Access in front of it, so with
 * NODE_ENV "development" and no token present the identity is a fixed
 * dev@localhost. A token that is present is always verified.
 */
export async function verifyAccessJwt(request: Request, env: AccessEnv): Promise<AccessIdentity | null> {
  const token = readAccessToken(request);

  if (!token) {
    if (process.env.NODE_ENV === "development") return { email: "dev@localhost" };
    return null;
  }

  const config = getAccessConfig(env);
  if (!config) {
    console.error("[access] ACCESS_TEAM_DOMAIN or ACCESS_AUD is not set");
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwksFor(config.teamDomain), {
      issuer: `https://${config.teamDomain}`,
      audience: config.aud,
    });
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

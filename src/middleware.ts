import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type AccessEnv, verifyAccessJwt } from "@/lib/access";

/**
 * Admin gate. Cloudflare Access fronts /admin and /api/admin at the edge and
 * handles the login redirect; this middleware re-verifies the Access JWT so
 * nothing under those prefixes runs for a request that did not pass it.
 *
 * On success the verified email travels to pages and route handlers as the
 * x-admin-email request header. The header is always overwritten here, so a
 * client-supplied value never reaches a handler.
 */

const ADMIN_EMAIL_HEADER = "x-admin-email";

function accessEnv(): AccessEnv {
  try {
    return getCloudflareContext().env as AccessEnv;
  } catch {
    return {
      ACCESS_TEAM_DOMAIN: process.env.ACCESS_TEAM_DOMAIN,
      ACCESS_AUD: process.env.ACCESS_AUD,
    };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/admin");

  const identity = await verifyAccessJwt(request, accessEnv());

  if (!identity) {
    if (isApi) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return new NextResponse("Access denied", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const headers = new Headers(request.headers);
  headers.set(ADMIN_EMAIL_HEADER, identity.email);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

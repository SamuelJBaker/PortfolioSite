import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NowItem, NowResponse } from "@/lib/now";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
};

/** Active Now items, ordered by kind then sort. Edge-cached for a minute. */
export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;

    const result = await env.ANALYTICS_DB.prepare(
      `SELECT id, kind, title, subtitle, isbn13, note, url, sort, active, updated_at
       FROM now_items WHERE active = 1 ORDER BY kind, sort, id`
    ).all<NowItem>();

    const body: NowResponse = {
      ok: true,
      items: result.results ?? [],
      fetchedAt: new Date().toISOString(),
    };
    return Response.json(body, { status: 200, headers: CACHE_HEADERS });
  } catch (err) {
    console.error("[api/now] error:", err);
    const body: NowResponse = { ok: false, items: [], fetchedAt: new Date().toISOString() };
    return Response.json(body, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

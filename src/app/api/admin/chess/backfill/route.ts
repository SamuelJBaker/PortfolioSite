import { getCloudflareContext } from "@opennextjs/cloudflare";
import { chess } from "@/content/chess";
import { backfill, isYearMonth, type ChessEnv } from "@/lib/chess/refresh";

export const dynamic = "force-dynamic";

/**
 * History import; behind the Access middleware. Safe to re-run. Optional
 * `since` (YYYY-MM) as a JSON body field or query parameter, default
 * chess.backfillSince; every month from there to now is re-fetched.
 */
export async function POST(request: Request) {
  try {
    let since: string = chess.backfillSince;
    const fromQuery = new URL(request.url).searchParams.get("since");
    if (fromQuery !== null) {
      if (!isYearMonth(fromQuery)) return Response.json({ ok: false, error: "since must be YYYY-MM." }, { status: 400 });
      since = fromQuery;
    } else if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as { since?: unknown };
      if (body.since !== undefined) {
        if (!isYearMonth(body.since)) return Response.json({ ok: false, error: "since must be YYYY-MM." }, { status: 400 });
        since = body.since;
      }
    }
    const { env } = await getCloudflareContext({ async: true });
    const result = await backfill(env as unknown as ChessEnv, since);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/admin/chess/backfill] error:", err);
    const message = err instanceof Error ? err.message : "Backfill failed.";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

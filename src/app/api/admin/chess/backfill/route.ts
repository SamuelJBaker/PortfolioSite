import { getCloudflareContext } from "@opennextjs/cloudflare";
import { backfill, type ChessEnv } from "@/lib/chess/refresh";

export const dynamic = "force-dynamic";

/** One-off history import; behind the Access middleware. Safe to re-run. */
export async function POST() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const result = await backfill(env as unknown as ChessEnv);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/admin/chess/backfill] error:", err);
    const message = err instanceof Error ? err.message : "Backfill failed.";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

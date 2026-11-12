import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cached } from "@/lib/cache";
import {
  CHESS_FALLBACK,
  CHESS_FRESH_SEC,
  CHESS_STALE_SEC,
  CHESS_SUMMARY_KEY,
  loadChessSummary,
  type ChessEnv,
} from "@/lib/chess/refresh";
import type { ChessSummary } from "@/lib/chess/types";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": `public, s-maxage=${CHESS_FRESH_SEC}, stale-while-revalidate=${CHESS_STALE_SEC}`,
};

/** Chess card summary. KV-cached; chess.com is never called on the request path once warm. */
export async function GET() {
  try {
    const { env: rawEnv, ctx } = await getCloudflareContext({ async: true });
    const env = rawEnv as unknown as ChessEnv;
    const result = await cached<ChessSummary>({
      kv: env.ANALYTICS_KV,
      key: CHESS_SUMMARY_KEY,
      freshSec: CHESS_FRESH_SEC,
      staleSec: CHESS_STALE_SEC,
      load: () => loadChessSummary(env),
      waitUntil: (p) => ctx.waitUntil(p),
      fallback: CHESS_FALLBACK,
    });
    const headers = result.source === "fallback" ? { "Cache-Control": "no-store" } : CACHE_HEADERS;
    return Response.json(result.data, { status: 200, headers });
  } catch (err) {
    console.error("[api/chess] error:", err);
    return Response.json(CHESS_FALLBACK, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}

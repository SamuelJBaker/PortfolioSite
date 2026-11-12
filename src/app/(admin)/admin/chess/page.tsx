import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ChessBackfillButton } from "@/components/admin/ChessBackfillButton";
import { chess } from "@/content/chess";
import type { CacheEntry } from "@/lib/cache";
import { CHESS_SUMMARY_KEY, type ChessEnv } from "@/lib/chess/refresh";
import type { ChessSummary } from "@/lib/chess/types";

export const dynamic = "force-dynamic";

export default async function ChessAdminPage() {
  let count = 0;
  let lastEnd: number | null = null;
  let cachedSummary: CacheEntry<ChessSummary> | null = null;
  let error = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const { ANALYTICS_DB, ANALYTICS_KV } = env as unknown as ChessEnv;
    const stats = await ANALYTICS_DB.prepare(
      "SELECT COUNT(*) AS count, MAX(end_time) AS last_end FROM chess_games WHERE time_class = ?"
    )
      .bind(chess.timeClass)
      .first<{ count: number; last_end: number | null }>();
    count = stats?.count ?? 0;
    lastEnd = stats?.last_end ?? null;
    cachedSummary = await ANALYTICS_KV.get<CacheEntry<ChessSummary>>(CHESS_SUMMARY_KEY, "json");
  } catch (err) {
    console.error("[admin/chess] failed to load:", err);
    error = true;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Chess</h1>
      <p className="text-sm text-muted mb-8">
        Rated {chess.timeClass} games for {chess.displayName} in D1, summarized by{" "}
        <span className="font-mono text-xs">/api/chess</span> (KV key{" "}
        <span className="font-mono text-xs">{CHESS_SUMMARY_KEY}</span>, fresh 10 min, stale 24 h).
      </p>

      {error && <p className="text-sm text-red-400 mb-6">Failed to read D1 or KV.</p>}

      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <div className="rounded-2xl border border-line bg-panel/35 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Rows</p>
          <p className="mt-2 text-3xl font-semibold">{count}</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel/35 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Last end_time</p>
          <p className="mt-2 text-lg font-semibold">
            {lastEnd ? new Date(lastEnd * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panel/35 p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Summary cached</p>
          <p className="mt-2 text-lg font-semibold">
            {cachedSummary ? new Date(cachedSummary.fetchedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "not yet"}
          </p>
        </div>
      </div>

      <h2 className="text-lg font-medium mb-3">Backfill</h2>
      <p className="text-sm text-muted mb-4">
        Walks every archive month from {chess.backfillSince} to now, one request at a time, and inserts
        rows that are not stored yet. Safe to re-run. Clears the cached summary when done.
      </p>
      <div className="mb-10">
        <ChessBackfillButton />
      </div>

      <h2 className="text-lg font-medium mb-3">Current summary</h2>
      <pre className="overflow-x-auto rounded-2xl border border-line bg-panel/35 p-5 font-mono text-xs text-body">
        {cachedSummary ? JSON.stringify(cachedSummary.data, null, 2) : "No cached summary. GET /api/chess builds it."}
      </pre>
    </div>
  );
}

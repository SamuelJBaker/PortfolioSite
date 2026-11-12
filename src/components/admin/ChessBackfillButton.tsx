"use client";

import * as React from "react";

interface BackfillResponse {
  ok: boolean;
  since?: string;
  months?: string[];
  inserted?: number;
  detail?: Array<{ month: string; mapped: number; inserted: number }>;
  stored?: { count: number; firstEndTime: number | null; lastEndTime: number | null };
  error?: string;
}

function day(t: number | null): string {
  return t ? new Date(t * 1000).toISOString().slice(0, 10) : "-";
}

export function ChessBackfillButton({ defaultSince }: { defaultSince: string }) {
  const [since, setSince] = React.useState(defaultSince);
  const [state, setState] = React.useState<{ busy: boolean; text: string | null }>({ busy: false, text: null });

  async function run() {
    setState({ busy: true, text: "Walking archives..." });
    try {
      const res = await fetch("/api/admin/chess/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      const body = (await res.json()) as BackfillResponse;
      if (!body.ok) {
        setState({ busy: false, text: `Failed: ${body.error ?? res.status}` });
        return;
      }
      const perMonth = (body.detail ?? []).map((d) => `${d.month}: ${d.mapped} mapped, ${d.inserted} new`).join("; ");
      const stored = body.stored
        ? ` Stored now: ${body.stored.count} rows, ${day(body.stored.firstEndTime)} to ${day(body.stored.lastEndTime)}.`
        : "";
      setState({ busy: false, text: `Done from ${body.since}: ${perMonth}.${stored} Reload to see the summary.` });
    } catch (err) {
      setState({ busy: false, text: `Failed: ${err instanceof Error ? err.message : "network error"}` });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-body">
        Since
        <input
          value={since}
          onChange={(e) => setSince(e.target.value)}
          pattern="[0-9]{4}-[0-9]{2}"
          placeholder="YYYY-MM"
          className="w-28 rounded-lg border border-line bg-panel/60 px-3 py-1.5 font-mono text-sm text-neutral-100 focus:outline-none focus:border-accent/45"
        />
      </label>
      <button
        type="button"
        onClick={run}
        disabled={state.busy}
        className="rounded-xl border border-accent/45 bg-accent/10 px-5 py-2 text-sm text-accent-text hover:bg-accent/15 transition disabled:opacity-50"
      >
        {state.busy ? "Running..." : "Run backfill"}
      </button>
      {state.text && <span className="text-sm text-muted">{state.text}</span>}
    </div>
  );
}

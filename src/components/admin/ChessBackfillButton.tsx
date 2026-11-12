"use client";

import * as React from "react";

export function ChessBackfillButton() {
  const [state, setState] = React.useState<{ busy: boolean; text: string | null }>({ busy: false, text: null });

  async function run() {
    setState({ busy: true, text: "Walking archives..." });
    try {
      const res = await fetch("/api/admin/chess/backfill", { method: "POST" });
      const body = (await res.json()) as { ok: boolean; months?: string[]; inserted?: number; error?: string };
      setState({
        busy: false,
        text: body.ok
          ? `Done: ${body.months?.length ?? 0} month(s) (${body.months?.join(", ")}), ${body.inserted ?? 0} new row(s). Reload to see the summary.`
          : `Failed: ${body.error ?? res.status}`,
      });
    } catch (err) {
      setState({ busy: false, text: `Failed: ${err instanceof Error ? err.message : "network error"}` });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
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

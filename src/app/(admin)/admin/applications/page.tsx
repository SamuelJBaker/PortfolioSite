import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { ATS_VALUES } from "@/lib/applications/fields";
import { OUTCOME_CLASS, OUTCOME_STATES, outcomeState, type OutcomeState } from "@/lib/applications/outcome";
import { type ApplicationEnv, loadStatsData, type StatsData } from "@/lib/applications/store";

export const dynamic = "force-dynamic";

const INPUT = "rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-accent/45";

type Search = { status?: string; ats?: string; version?: string; outcome?: string; q?: string };

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f: Search = { status: first(sp.status), ats: first(sp.ats), version: first(sp.version), outcome: first(sp.outcome), q: first(sp.q).trim().toLowerCase() };

  let data: StatsData | null = null;
  let dbError = false;
  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv;
    data = await loadStatsData(db);
  } catch (err) {
    console.error("[admin/applications] failed to load:", err);
    dbError = true;
  }

  const now = new Date().toISOString();
  const rows = data
    ? data.rows.map((r, i) => ({ r, state: outcomeState(data.inputs[i], now, data.config) }))
    : [];
  const versionLabel = new Map((data?.versions ?? []).map((v) => [v.id, v.label]));
  const filtered = rows.filter(({ r, state }) => {
    if (f.status && r.status !== f.status) return false;
    if (f.ats && (r.ats ?? "") !== f.ats) return false;
    if (f.version && (r.resume_version_id ?? "") !== f.version) return false;
    if (f.outcome && state !== (f.outcome as OutcomeState)) return false;
    if (f.q) {
      const hay = [r.company, r.role_title, r.location, r.industry, r.requisition_id, r.key, r.posting_url].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <div className="flex items-center gap-3">
          <a href="/api/admin/applications/export.csv" className="text-sm text-muted hover:text-neutral-200 transition">Export CSV</a>
          <Link href="/admin/applications/new" className="rounded-xl border border-accent/45 bg-accent/10 px-4 py-2 text-sm text-accent-text hover:bg-accent/15 transition">New application</Link>
        </div>
      </div>
      <p className="text-sm text-muted mb-6">
        {rows.length} rows; {rows.filter((x) => x.r.status === "applied").length} applied, {rows.filter((x) => x.r.status === "saved").length} in the backlog.
        Outcome states follow the model: positive is a human advance within T days; ghosted is T days with nothing.
      </p>

      <form method="GET" className="flex flex-wrap items-end gap-3 mb-6">
        <select name="status" defaultValue={f.status} className={INPUT} aria-label="Status">
          <option value="">status: all</option>
          <option value="saved">saved</option>
          <option value="applied">applied</option>
          <option value="withdrawn">withdrawn</option>
        </select>
        <select name="ats" defaultValue={f.ats} className={INPUT} aria-label="ATS">
          <option value="">ats: all</option>
          {ATS_VALUES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select name="version" defaultValue={f.version} className={INPUT} aria-label="Version">
          <option value="">version: all</option>
          {(data?.versions ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={f.outcome} className={INPUT} aria-label="Outcome">
          <option value="">outcome: all</option>
          {OUTCOME_STATES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={first(sp.q)} placeholder="search company, role, key..." className={INPUT + " w-64"} aria-label="Search" />
        <button type="submit" className="rounded-xl border border-line bg-panel/40 px-4 py-1.5 text-sm text-neutral-200 hover:bg-panel/60 transition">Filter</button>
        {(f.status || f.ats || f.version || f.outcome || f.q) && (
          <Link href="/admin/applications" className="text-xs text-muted hover:text-neutral-200">clear</Link>
        )}
      </form>

      {dbError && <p className="text-sm text-red-400">Failed to load applications.</p>}
      {!dbError && filtered.length === 0 && <p className="text-sm text-muted">No applications match.</p>}
      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-line text-muted text-left">
                <th className="pb-3 pr-4 font-medium">#</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Company</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">ATS</th>
                <th className="pb-3 pr-4 font-medium">Applied</th>
                <th className="pb-3 pr-4 font-medium">Version</th>
                <th className="pb-3 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel">
              {filtered.map(({ r, state }) => (
                <tr key={r.id} className="text-body">
                  <td className="py-2 pr-4 font-mono text-xs">
                    <a href={`/admin/applications/${r.id}`} className="text-accent/80 hover:text-accent">{r.id}</a>
                  </td>
                  <td className="py-2 pr-4 text-xs">{r.status}</td>
                  <td className="py-2 pr-4">
                    <a href={`/admin/applications/${r.id}`} className="hover:text-neutral-100">{r.company}</a>
                  </td>
                  <td className="py-2 pr-4">{r.role_title ?? "-"}</td>
                  <td className="py-2 pr-4 text-xs">{r.ats ?? "-"}</td>
                  <td className="py-2 pr-4 text-xs text-neutral-500">{r.applied_at ? r.applied_at.slice(0, 10) : "-"}</td>
                  <td className="py-2 pr-4 text-xs">{r.resume_version_id ? (versionLabel.get(r.resume_version_id) ?? r.resume_version_id) : "-"}</td>
                  <td className={"py-2 text-xs " + OUTCOME_CLASS[state]}>{state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

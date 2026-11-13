import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { countryName } from "@/lib/countries";
import type { SessionClass } from "@/lib/tracking/classify";
import { filterBots, loadSessionClasses, showBotsParam } from "@/lib/tracking/sessions";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

const CLS: Record<SessionClass, string> = { human: "text-green-400", bot: "text-red-400", unknown: "text-neutral-500" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const showBots = showBotsParam((await searchParams).bots);
  let totalVisits = 0;
  let uniqueSessions = 0;
  let counts: Record<SessionClass, number> = { bot: 0, human: 0, unknown: 0 };
  let recentEvents: Array<{ event: string; ts: string; key: string | null; country: string | null; cls: SessionClass }> = [];
  let dbError = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const all = await loadSessionClasses(db);
    counts = all.counts;
    const rows = filterBots(all.rows, all.classes, showBots);
    totalVisits = rows.filter((r) => r.event === "visit_server").length;
    uniqueSessions = new Set(rows.map((r) => r.session_id)).size;
    recentEvents = rows
      .slice(-20)
      .reverse()
      .map((r) => ({ event: r.event, ts: r.ts, key: r.key, country: r.country, cls: all.classes.get(r.session_id) ?? "unknown" }));
  } catch (err) {
    console.error("[admin] failed to load stats:", err);
    dbError = true;
  }

  return (
  <div>
    <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
    <p className="text-sm text-muted mb-2">Quick overview. See <a href="/admin/analytics" className="text-accent/80 hover:text-accent transition">Analytics</a> for full detail.</p>
    <p className="text-sm text-muted mb-8" data-testid="class-line">
      Sessions: <span className="text-green-400">{counts.human} human</span>, {counts.unknown} unknown, <span className="text-red-400">{counts.bot} bot</span>.{" "}
      {showBots ? (
        <>Bot sessions included. <a href="/admin" className="underline hover:text-neutral-100">Hide bots</a></>
      ) : (
        <>Bot sessions hidden. <a href="/admin?bots=1" className="underline hover:text-neutral-100">Show bots</a></>
      )}
    </p>

    <div className="grid gap-4 sm:grid-cols-2 mb-10">
      <div className="rounded-2xl border border-line bg-panel/35 p-5">
        <p className="text-xs uppercase tracking-widest text-muted">Total visits</p>
        <p className="mt-2 text-3xl font-semibold">{totalVisits}</p>
      </div>
      <div className="rounded-2xl border border-line bg-panel/35 p-5">
        <p className="text-xs uppercase tracking-widest text-muted">Unique sessions</p>
        <p className="mt-2 text-3xl font-semibold">{uniqueSessions}</p>
      </div>
    </div>

    <h2 className="text-lg font-medium mb-4">Recent events</h2>
    {recentEvents.length === 0 && !dbError && (
      <p className="text-sm text-muted">No events yet.</p>
    )}
    {recentEvents.length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-line text-muted text-left">
              <th className="pb-3 pr-6 font-medium">Event</th>
              <th className="pb-3 pr-6 font-medium">Class</th>
              <th className="pb-3 pr-6 font-medium">Key</th>
              <th className="pb-3 pr-6 font-medium">Country</th>
              <th className="pb-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel">
            {recentEvents.map((e, i) => (
              <tr key={i} className="text-body">
                <td className="py-3 pr-6 font-mono text-xs">{e.event}</td>
                <td className={"py-3 pr-6 text-xs " + CLS[e.cls]}>{e.cls}</td>
                <td className="py-3 pr-6">{e.key ?? "-"}</td>
                <td className="py-3 pr-6">{countryName(e.country ?? "")}</td>
                <td className="py-3 text-neutral-500 text-xs">{e.ts.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
}

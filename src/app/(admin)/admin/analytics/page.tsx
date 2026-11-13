import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import type { SessionClass } from "@/lib/tracking/classify";
import { filterBots, loadSessionClasses, showBotsParam } from "@/lib/tracking/sessions";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

export type KeyStat = { key: string; visits: number; last_visit: string | null };
export type DayStat = { day: string; visits: number };
export type EventStat = { event: string; count: number };
export type CountryStat = { country: string; visits: number };
export type KeyDayStat = { key: string; day: string; visits: number };
export type ClassCounts = Record<SessionClass, number>;

/**
 * The aggregates are computed here from the classified rows rather than in
 * SQL so bot sessions can be left out (phase 8, step 9). Same shapes as before.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const showBots = showBotsParam((await searchParams).bots);
  let keyStats: KeyStat[] = [];
  let timeline: DayStat[] = [];
  let eventStats: EventStat[] = [];
  let countryStats: CountryStat[] = [];
  let keyTimeline: KeyDayStat[] = [];
  let liveCount = 0;
  let classCounts: ClassCounts = { bot: 0, human: 0, unknown: 0 };
  let dbError = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const db = env.ANALYTICS_DB;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const all = await loadSessionClasses(db);
    classCounts = all.counts;
    const rows = filterBots(all.rows, all.classes, showBots);

    const keys = new Map<string, KeyStat>();
    const days = new Map<string, number>();
    const events = new Map<string, number>();
    const countries = new Map<string, number>();
    const keyDays = new Map<string, number>();
    const live = new Set<string>();
    for (const r of rows) {
      events.set(r.event, (events.get(r.event) ?? 0) + 1);
      if (r.ts >= fiveMinutesAgo) live.add(r.session_id);
      if (r.event !== "visit_server") continue;
      const day = r.ts.slice(0, 10);
      if (r.key) {
        const k = keys.get(r.key) ?? { key: r.key, visits: 0, last_visit: null };
        k.visits++;
        if (!k.last_visit || r.ts > k.last_visit) k.last_visit = r.ts;
        keys.set(r.key, k);
        if (day >= thirtyDaysAgo) keyDays.set(`${r.key}\u0000${day}`, (keyDays.get(`${r.key}\u0000${day}`) ?? 0) + 1);
      }
      if (day >= thirtyDaysAgo) days.set(day, (days.get(day) ?? 0) + 1);
      if (r.country) countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
    }
    keyStats = [...keys.values()].sort((a, b) => b.visits - a.visits);
    timeline = [...days].map(([day, visits]) => ({ day, visits })).sort((a, b) => a.day.localeCompare(b.day));
    eventStats = [...events].map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count);
    countryStats = [...countries].map(([country, visits]) => ({ country, visits })).sort((a, b) => b.visits - a.visits);
    keyTimeline = [...keyDays]
      .map(([k, visits]) => {
        const [key, day] = k.split("\u0000");
        return { key, day, visits };
      })
      .sort((a, b) => a.key.localeCompare(b.key) || a.day.localeCompare(b.day));
    liveCount = live.size;
  } catch (err) {
    console.error("[admin/analytics] error:", err);
    dbError = true;
  }

  if (dbError) {
    return <p className="text-sm text-red-400">Failed to load analytics data.</p>;
  }

  return (
    <AnalyticsDashboard
      keyStats={keyStats}
      timeline={timeline}
      eventStats={eventStats}
      countryStats={countryStats}
      keyTimeline={keyTimeline}
      liveCount={liveCount}
      classCounts={classCounts}
      showBots={showBots}
    />
  );
}

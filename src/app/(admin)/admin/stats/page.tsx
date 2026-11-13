import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KmCurve } from "@/components/admin/KmCurve";
import { StatsConfigForm } from "@/components/admin/StatsConfigForm";
import {
  assignVersion,
  DIMENSIONS,
  factorStats,
  FLOOR_WINDOW,
  funnel,
  kaplanMeier,
  priorityScores,
  segmentStats,
  timingByAts,
  versionStats,
  weekly,
  type Dimension,
  type SegmentStat,
} from "@/lib/appstats";
import { type ApplicationEnv, CONFIG_NAME_LIST, loadStatsData, type StatsData } from "@/lib/applications/store";
import { isActiveStatus } from "@/lib/resumes/versions";
import { writeConfig } from "./actions";

export const dynamic = "force-dynamic";

const TH = "pb-2 pr-4 font-medium text-left";
const TD = "py-1.5 pr-4";
const DIM_LABEL: Record<Dimension, string> = {
  ats: "ATS",
  sourceChannel: "Source channel",
  roleFamily: "Role family",
  workMode: "Work mode",
  level: "Level",
  companySizeBand: "Company size",
  industry: "Industry",
  coverLetter: "Cover letter",
  referral: "Referral",
  fit: "Fit",
  postingAge: "Posting age (days)",
  salary: "Salary tercile",
};

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "-" : `${(x * 100).toFixed(1)}%`);
const ivl = (i: [number, number] | null | undefined) => (i ? `[${(i[0] * 100).toFixed(1)}, ${(i[1] * 100).toFixed(1)}]` : "-");
const num = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "-" : x.toFixed(d));

function H2({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="text-lg font-medium mt-12 mb-3">
      {children}
    </h2>
  );
}

function SegmentTable({ dimension, rows, sort }: { dimension: Dimension; rows: SegmentStat[]; sort: "rate" | "yield" }) {
  const sorted = [...rows].sort((a, b) => (sort === "yield" ? (b.yieldPerHour ?? -1) - (a.yieldPerHour ?? -1) : b.rate - a.rate));
  return (
    <div className="mb-6">
      <h3 className="text-sm text-neutral-200 mb-1">{DIM_LABEL[dimension]}</h3>
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className={TH}>Level</th>
            <th className={TH}>n</th>
            <th className={TH}>k</th>
            <th className={TH}>Rate</th>
            <th className={TH}>80%</th>
            <th className={TH}>Effort h</th>
            <th className={TH}>Yield /h</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel">
          {sorted.map((r) => (
            <tr key={r.level} className={r.small ? "text-neutral-600" : "text-body"}>
              <td className={TD}>{r.level}</td>
              <td className={TD + " font-mono text-xs"}>{r.n}</td>
              <td className={TD + " font-mono text-xs"}>{r.k}</td>
              <td className={TD + " font-mono text-xs"}>{pct(r.rate)}</td>
              <td className={TD + " font-mono text-xs"}>{ivl(r.interval)}</td>
              <td className={TD + " font-mono text-xs"}>{num(r.meanEffortHours)}</td>
              <td className={TD + " font-mono text-xs"}>{num(r.yieldPerHour, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sort = sp.sort === "yield" ? "yield" : "rate";

  let data: StatsData | null = null;
  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv;
    data = await loadStatsData(db);
  } catch (err) {
    console.error("[admin/stats] failed to load:", err);
  }
  if (!data) return <p className="text-sm text-red-400">Failed to load statistics.</p>;

  const now = new Date().toISOString();
  const { inputs, versionInputs, config } = data;
  const seed = Math.floor(Date.now() / 1000);
  const label = new Map(versionInputs.map((v) => [v.id, v.label]));

  const vs = versionStats(versionInputs, inputs, now, config, seed);
  const factors = factorStats(versionInputs, inputs, now, config);
  const live = versionInputs.filter((v) => isActiveStatus(v.status));
  const next = live.length > 0 ? assignVersion(live, null, inputs, now, config, seed) : null;
  const recent = inputs
    .filter((a) => a.assignedBy === "random" && a.resumeVersionId !== null && a.appliedAt !== null)
    .sort((a, b) => Date.parse(b.appliedAt ?? "") - Date.parse(a.appliedAt ?? ""))
    .slice(0, FLOOR_WINDOW);
  const segments = segmentStats(inputs, now, config);
  const fn = funnel(inputs, now, config);
  const km = kaplanMeier(inputs, now, config);
  const kmAts = timingByAts(inputs, now, config);
  const saved = inputs.filter((a) => a.status === "saved");
  const applied = inputs.filter((a) => a.status !== "saved");
  const backlog = priorityScores(saved, applied, now, config);
  const weeks = weekly(inputs, now, config);
  const appById = new Map(data.rows.map((r) => [r.id, r]));
  const current: Record<string, number> = { T_days: config.tDays, V_days: config.vDays, a0: config.a0, b0: config.b0, m: config.m, floor: config.floor };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Stats</h1>
      <p className="text-sm text-muted mb-2">
        docs/handoff/APPLICATION-STATS-MODEL.md, computed now from {inputs.length} applications ({applied.length} submitted, {vs.resolvedTotal} resolved in the version comparison).
        Every rate shows its n; unresolved rows never enter a rate. T = {config.tDays} d, V = {config.vDays} d, prior Beta({num(vs.prior.a0, 2)}, {num(vs.prior.b0, 2)})
        {vs.prior.recentred ? " re-centred on the observed rate" : ""}, m = {config.m}, floor = {config.floor}.
      </p>
      <nav className="text-xs text-muted flex flex-wrap gap-4 mb-2">
        {["versions", "segments", "funnel", "timing", "backlog", "week", "config"].map((s) => (
          <a key={s} href={`#${s}`} className="hover:text-neutral-100">
            {s}
          </a>
        ))}
      </nav>

      <H2 id="versions">1. Versions</H2>
      {vs.versions.length === 0 ? (
        <p className="text-sm text-muted">No resume versions yet.</p>
      ) : (
        <>
          <table className="text-sm border-collapse">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className={TH}>Version</th>
                <th className={TH}>Status</th>
                <th className={TH}>n</th>
                <th className={TH}>k</th>
                <th className={TH}>Mean</th>
                <th className={TH}>80%</th>
                <th className={TH}>P(best)</th>
                <th className={TH}>nV</th>
                <th className={TH}>kV</th>
                <th className={TH}>Mean V</th>
                <th className={TH}>P(best V)</th>
                <th className={TH}>Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel">
              {vs.versions.map((v) => (
                <tr key={v.id} className={v.live ? "text-body" : "text-neutral-600"}>
                  <td className={TD}>{label.get(v.id) ?? v.id}</td>
                  <td className={TD + " text-xs"}>{versionInputs.find((x) => x.id === v.id)?.status}</td>
                  <td className={TD + " font-mono text-xs"}>{v.n}</td>
                  <td className={TD + " font-mono text-xs"}>{v.k}</td>
                  <td className={TD + " font-mono text-xs"}>{pct(v.mean)}</td>
                  <td className={TD + " font-mono text-xs"}>{ivl(v.interval)}</td>
                  <td className={TD + " font-mono text-xs"}>{v.pBest === null ? "-" : v.pBest.toFixed(3)}</td>
                  <td className={TD + " font-mono text-xs"}>{v.nV}</td>
                  <td className={TD + " font-mono text-xs"}>{v.kV}</td>
                  <td className={TD + " font-mono text-xs"}>{pct(v.meanV)}</td>
                  <td className={TD + " font-mono text-xs"}>{v.pBestV === null ? "-" : v.pBestV.toFixed(3)}</td>
                  <td className={TD + " text-xs"}>
                    {v.retire ? <span className="text-red-400">retire </span> : null}
                    {v.promote ? <span className="text-green-400">promote </span> : null}
                    {next && next.versionId === v.id ? <span className="text-accent-text">next{next.reason === "floor" ? " (floor)" : next.reason === "single" ? " (only)" : " (this draw)"}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            Rows: resolved, untailored, non-referral, non-withdrawn, manual assignments included. P(best) over the live versions, 20000 draws. Retire: P(best) under 0.10 with n at least 25; promote: over 0.85 with n at least 25.
            Next assignment: {next ? (next.reason === "floor" ? `${label.get(next.versionId)} is under the ${config.floor * 100} percent floor over the last ${recent.length} random assignments.` : `a Thompson draw (this page's draw picked ${label.get(next.versionId)}).`) : "no live version."}
            {recent.length > 0 && ` Shares of the last ${recent.length}: ${live.map((v) => `${v.label} ${Math.round((recent.filter((a) => a.resumeVersionId === v.id).length / recent.length) * 100)}%`).join(", ")}.`}
          </p>
          {factors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm text-neutral-200 mb-1">Factor levels (pooled over versions)</h3>
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className={TH}>Factor</th>
                    <th className={TH}>Level</th>
                    <th className={TH}>Versions</th>
                    <th className={TH}>n</th>
                    <th className={TH}>k</th>
                    <th className={TH}>Mean</th>
                    <th className={TH}>80%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel">
                  {factors.map((f) => (
                    <tr key={`${f.factor}:${f.level}`} className="text-body">
                      <td className={TD}>{f.factor}</td>
                      <td className={TD}>{f.level}</td>
                      <td className={TD + " text-xs"}>{f.versions.map((id) => label.get(id) ?? id).join(", ")}</td>
                      <td className={TD + " font-mono text-xs"}>{f.n}</td>
                      <td className={TD + " font-mono text-xs"}>{f.k}</td>
                      <td className={TD + " font-mono text-xs"}>{pct(f.mean)}</td>
                      <td className={TD + " font-mono text-xs"}>{ivl(f.interval)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <H2 id="segments">2. Segments</H2>
      <p className="text-sm text-muted mb-4">
        Shrunk rates (k + m p0) / (n + m); descriptive only. Cells with n under 10 are greyed. Sort by{" "}
        <a href="?sort=rate#segments" className={sort === "rate" ? "text-neutral-100" : "underline"}>rate</a> or{" "}
        <a href="?sort=yield#segments" className={sort === "yield" ? "text-neutral-100" : "underline"}>yield</a>.
      </p>
      {segments.length === 0 ? (
        <p className="text-sm text-muted">No resolved applications yet.</p>
      ) : (
        <div className="grid gap-x-10 lg:grid-cols-2">
          {DIMENSIONS.map((d) => {
            const rows = segments.filter((s) => s.dimension === d);
            return rows.length > 0 ? <SegmentTable key={d} dimension={d} rows={rows} sort={sort} /> : null;
          })}
        </div>
      )}

      <H2 id="funnel">3. Funnel</H2>
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className={TH}>Stage</th>
            <th className={TH}>Count</th>
            <th className={TH}>From previous</th>
            <th className={TH}>80%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel">
          {fn.rows.map((r) => (
            <tr key={r.stage} className="text-body">
              <td className={TD}>{r.stage}</td>
              <td className={TD + " font-mono text-xs"}>{r.count}</td>
              <td className={TD + " font-mono text-xs"}>{r.fromPrevious ? pct(r.fromPrevious.rate) : "-"}</td>
              <td className={TD + " font-mono text-xs"}>{r.fromPrevious ? ivl(r.fromPrevious.interval) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500">Unresolved applications: {fn.unresolved} (counted in applied only). Human visit is any human session on the key; response is any company-originated event.</p>

      <H2 id="timing">4. Timing</H2>
      <p className="text-sm text-muted mb-3">
        Kaplan-Meier days to first response over {km.n} submitted applications, {km.responses} responses, unresolved rows censored at their age. Median {km.medianDays === null ? "not reached" : `${km.medianDays} d`}; 90 percent of responses by{" "}
        {km.day90 === null ? `- (needs ${20} responses)` : `${km.day90} d`}.
      </p>
      {km.n > 0 ? <KmCurve km={km} /> : <p className="text-sm text-muted">No submitted applications yet.</p>}
      {Object.keys(kmAts).length > 0 && (
        <table className="text-sm border-collapse mt-4">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className={TH}>ATS</th>
              <th className={TH}>n</th>
              <th className={TH}>Responses</th>
              <th className={TH}>Median d</th>
              <th className={TH}>90% d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel">
            {Object.entries(kmAts).map(([ats, k]) => (
              <tr key={ats} className="text-body">
                <td className={TD}>{ats}</td>
                <td className={TD + " font-mono text-xs"}>{k.n}</td>
                <td className={TD + " font-mono text-xs"}>{k.responses}</td>
                <td className={TD + " font-mono text-xs"}>{k.medianDays ?? "-"}</td>
                <td className={TD + " font-mono text-xs"}>{k.day90 ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <H2 id="backlog">5. Backlog</H2>
      {backlog.length === 0 ? (
        <p className="text-sm text-muted">Nothing saved.</p>
      ) : (
        <table className="text-sm border-collapse">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className={TH}>#</th>
              <th className={TH}>Company</th>
              <th className={TH}>Role</th>
              <th className={TH}>ATS</th>
              <th className={TH}>p</th>
              <th className={TH}>Effort h</th>
              <th className={TH}>Score</th>
              <th className={TH}>From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel">
            {backlog.map((b) => {
              const a = appById.get(b.id);
              return (
                <tr key={b.id} className="text-body">
                  <td className={TD + " font-mono text-xs"}>
                    <a href={`/admin/applications/${b.id}`} className="text-accent/80 hover:text-accent">{b.id}</a>
                  </td>
                  <td className={TD}>{a?.company}</td>
                  <td className={TD}>{a?.role_title ?? "-"}</td>
                  <td className={TD + " text-xs"}>{a?.ats ?? "-"}</td>
                  <td className={TD + " font-mono text-xs"}>{pct(b.p)}</td>
                  <td className={TD + " font-mono text-xs"}>{num(b.expectedEffortHours)}</td>
                  <td className={TD + " font-mono text-xs"}>{num(b.score, 3)}</td>
                  <td className={TD + " text-xs text-neutral-500"}>{b.contributions.map((c) => `${DIM_LABEL[c.dimension]} ${c.level} ${pct(c.rate)}`).join("; ") || "base rate"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-neutral-500">score = p / expected effort hours, with p from the damped odds product over the segment rates (model section 8). A ranking, not a probability to quote.</p>

      <H2 id="week">6. Week</H2>
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className={TH}>Week of</th>
            <th className={TH}>Sent</th>
            <th className={TH}>Effort h</th>
            <th className={TH}>Resolved</th>
            <th className={TH}>Positives</th>
            <th className={TH}>Human visits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel">
          {weeks.map((w, i) => (
            <tr key={w.weekStart} className={i === 0 ? "text-neutral-100" : "text-body"}>
              <td className={TD + " font-mono text-xs"}>{w.weekStart}{i === 0 ? " (this week)" : ""}</td>
              <td className={TD + " font-mono text-xs"}>{w.sent}</td>
              <td className={TD + " font-mono text-xs"}>{num(w.effortHours, 1)}</td>
              <td className={TD + " font-mono text-xs"}>{w.resolved}</td>
              <td className={TD + " font-mono text-xs"}>{w.positives}</td>
              <td className={TD + " font-mono text-xs"}>{w.humanVisits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {weeks[0] && Object.keys(weeks[0].pipeline).length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Pipeline now: {Object.entries(weeks[0].pipeline).map(([stage, n]) => `${stage} ${n}`).join(", ")}.
        </p>
      )}

      <H2 id="config">Model constants</H2>
      <p className="text-sm text-muted mb-3">Append-only; the latest row per name is in force. A change to Y or T is dated here, and rates are not comparable across it (model section 9).</p>
      <StatsConfigForm names={CONFIG_NAME_LIST} current={current} action={writeConfig} />
      <table className="text-sm border-collapse mt-4">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className={TH}>Changed</th>
            <th className={TH}>Name</th>
            <th className={TH}>Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel">
          {data.configRows.map((r, i) => (
            <tr key={i} className="text-body">
              <td className={TD + " text-xs text-neutral-500"}>{r.changed_at.slice(0, 16).replace("T", " ")}</td>
              <td className={TD + " font-mono text-xs"}>{r.name}</td>
              <td className={TD + " font-mono text-xs"}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

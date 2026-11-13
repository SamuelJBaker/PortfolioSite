import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationForm, ApplyExistingForm, BUTTON_QUIET, type VersionOption } from "@/components/admin/ApplicationForm";
import { EventLogForm } from "@/components/admin/EventLogForm";
import { applicationOutcome } from "@/lib/appstats";
import { OUTCOME_CLASS, outcomeState } from "@/lib/applications/outcome";
import {
  type ApplicationEnv,
  type ApplicationEventRow,
  type ApplicationRow,
  getApplication,
  type KeySession,
  listEvents,
  loadConfig,
  sessionsForKeys,
  toApplicationInput,
} from "@/lib/applications/store";
import { countryName } from "@/lib/countries";
import { listVersions } from "@/lib/resumes/store";
import { addEvent, applyExisting, removeEvent, toggleTailored, updateApplication } from "../actions";

export const dynamic = "force-dynamic";

const CLS: Record<string, string> = { human: "text-green-400", bot: "text-red-400", unknown: "text-neutral-500" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let app: ApplicationRow | null = null;
  let events: ApplicationEventRow[] = [];
  let sessions: KeySession[] = [];
  let versions: VersionOption[] = [];
  let versionLabel = "";
  let summary: { state: string; y: string; v: string; stage: string; days: string } | null = null;
  let dbError = false;
  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv;
    app = await getApplication(db, id);
    if (app) {
      const [ev, vs, cfg] = await Promise.all([listEvents(db, id), listVersions(db), loadConfig(db)]);
      events = ev;
      versions = vs.map((v) => ({ id: v.id, label: v.label, status: v.status }));
      versionLabel = vs.find((v) => v.id === app?.resume_version_id)?.label ?? app.resume_version_id ?? "";
      if (app.key) sessions = (await sessionsForKeys(db, [app.key])).get(app.key) ?? [];
      const now = new Date().toISOString();
      const input = toApplicationInput(app, events, sessions);
      const o = applicationOutcome(input, now, cfg.config);
      summary = {
        state: outcomeState(input, now, cfg.config),
        y: o.y === null ? (o.excludedFromVersions ? `excluded (${o.excludedFromVersions})` : "open") : String(o.y),
        v: o.v === null ? "open" : String(o.v),
        stage: o.stage,
        days: o.daysToFirstResponse === null ? "-" : o.daysToFirstResponse.toFixed(1),
      };
    }
  } catch (err) {
    console.error("[admin/applications/id] failed to load:", err);
    dbError = true;
  }
  if (dbError) return <p className="text-sm text-red-400">Failed to load the application.</p>;
  if (!app) notFound();

  const applied = app.status !== "saved";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">
          #{app.id} {app.company}
          {app.role_title ? <span className="text-muted"> - {app.role_title}</span> : null}
        </h1>
        <Link href="/admin/applications" className="text-sm text-muted hover:text-neutral-200 transition">Back to applications</Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-6">
        <span className="text-xs uppercase tracking-widest text-muted">{app.status}</span>
        {summary && <span className={OUTCOME_CLASS[summary.state as keyof typeof OUTCOME_CLASS] ?? ""}>{summary.state}</span>}
        {applied && (
          <>
            <span>
              <span className="text-muted">key </span>
              <a href={`https://samueljbaker.dev/v/${app.key}`} className="font-mono text-xs text-accent/80 hover:text-accent" data-testid="app-key">
                {app.key}
              </a>
            </span>
            <span>
              <span className="text-muted">version </span>
              {versionLabel} <span className="text-neutral-500">({app.assigned_by})</span>
            </span>
            <span>
              <span className="text-muted">applied </span>
              {app.applied_at?.slice(0, 10)}
            </span>
            {summary && (
              <span className="text-xs text-neutral-500" data-testid="outcome-summary">
                Y {summary.y} &middot; V {summary.v} &middot; stage {summary.stage} &middot; first response {summary.days} d
              </span>
            )}
            <a href={`/api/admin/applications/${app.id}/resume.pdf`} className={BUTTON_QUIET + " text-xs"}>
              Stamped PDF
            </a>
            <form action={toggleTailored}>
              <input type="hidden" name="id" value={app.id} />
              <button type="submit" className={(app.tailored ? "text-accent-text " : "text-neutral-500 ") + "text-xs hover:text-neutral-100 transition"}>
                {app.tailored ? "Tailored (click to unmark)" : "Mark tailored"}
              </button>
            </form>
          </>
        )}
      </div>

      {!applied && (
        <div className="mb-8">
          <ApplyExistingForm id={app.id} defaults={app} versions={versions} action={applyExisting} />
        </div>
      )}

      <ApplicationForm mode="edit" id={app.id} defaults={app} applied={applied} versions={versions} action={updateApplication} />

      <h2 className="text-lg font-medium mt-12 mb-3">Events</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted mb-3">No events yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse mb-3">
          <thead>
            <tr className="border-b border-line text-muted text-left">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 font-medium">Auto</th>
              <th className="pb-2 pr-4 font-medium">Note</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel">
            {events.map((e) => (
              <tr key={e.id} className="text-body">
                <td className="py-2 pr-4 text-xs text-neutral-500">{e.at.slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-4 font-mono text-xs">{e.type}</td>
                <td className="py-2 pr-4 text-xs">{e.auto ? "auto" : ""}</td>
                <td className="py-2 pr-4">{e.note ?? ""}</td>
                <td className="py-2 text-right">
                  <form action={removeEvent}>
                    <input type="hidden" name="id" value={app.id} />
                    <input type="hidden" name="event_id" value={e.id} />
                    <button type="submit" className="text-xs text-neutral-500 hover:text-red-400 transition">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <EventLogForm id={app.id} action={addEvent} today={today} />

      <h2 className="text-lg font-medium mt-12 mb-3">Sessions on the key</h2>
      {!applied && <p className="text-sm text-muted">No key until applied.</p>}
      {applied && sessions.length === 0 && <p className="text-sm text-muted">No visits yet.</p>}
      {sessions.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-line text-muted text-left">
              <th className="pb-2 pr-4 font-medium">Time</th>
              <th className="pb-2 pr-4 font-medium">Class</th>
              <th className="pb-2 pr-4 font-medium">Country</th>
              <th className="pb-2 font-medium">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel">
            {sessions.map((s) => (
              <tr key={s.sessionId} className="text-body" data-testid="session-row">
                <td className="py-2 pr-4 text-xs text-neutral-500">{s.at.slice(0, 16).replace("T", " ")}</td>
                <td className={"py-2 pr-4 text-xs " + (CLS[s.cls] ?? "")}>{s.cls}</td>
                <td className="py-2 pr-4 text-xs">{countryName(s.country ?? "") || "-"}</td>
                <td className="py-2 font-mono text-xs">{s.events.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

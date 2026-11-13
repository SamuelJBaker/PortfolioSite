import { DEFAULT_CONFIG, type ApplicationInput, type ResumeVersionInput, type StatsConfig } from "@/lib/appstats";
import { parseFactorsJson, type ResumeVersion } from "@/lib/resumes/versions";
import { listVersions } from "@/lib/resumes/store";
import { classifySession, type SessionClass } from "@/lib/tracking/classify";
import type { ApplicationFields, EventType } from "./fields";

/**
 * D1 access for applications, application_events, stats_config and the
 * sessions on an application's key. Pages and actions go through here; the
 * statistics library only ever sees the adapted ApplicationInput rows.
 */

export interface ApplicationEnv {
  ANALYTICS_DB: D1Database;
  R2_ASSETS: R2Bucket;
}

export interface ApplicationRow extends ApplicationFields {
  id: number;
  key: string | null;
  status: "saved" | "applied" | "withdrawn";
  created_at: string;
  applied_at: string | null;
  resume_version_id: string | null;
  assigned_by: "random" | "manual" | null;
}

export interface ApplicationEventRow {
  id: number;
  application_id: number;
  type: EventType;
  at: string;
  auto: number;
  note: string | null;
}

export interface KeySession {
  sessionId: string;
  /** visit_server time, or the first event's time. */
  at: string;
  cls: SessionClass;
  country: string | null;
  events: string[];
}

export const FIELD_COLUMNS: (keyof ApplicationFields)[] = [
  "company", "company_size_band", "industry", "role_title", "role_family", "level", "location", "work_mode",
  "salary_min", "salary_max", "salary_period", "benefits", "ats", "source_channel", "posted_at", "posting_age_days",
  "applicant_count", "requisition_id", "posting_url", "referral", "cover_letter", "tailored", "fit", "effort_minutes",
];

const ALL_COLUMNS = ["id", "key", "status", "created_at", "applied_at", "resume_version_id", "assigned_by", ...FIELD_COLUMNS].join(", ");

export async function listApplications(db: D1Database): Promise<ApplicationRow[]> {
  const r = await db.prepare(`SELECT ${ALL_COLUMNS} FROM applications ORDER BY COALESCE(applied_at, created_at) DESC, id DESC`).all<ApplicationRow>();
  return r.results ?? [];
}

export async function getApplication(db: D1Database, id: number): Promise<ApplicationRow | null> {
  return db.prepare(`SELECT ${ALL_COLUMNS} FROM applications WHERE id = ?`).bind(id).first<ApplicationRow>();
}

/** The most recent row, whose selects become the next form's defaults. */
export async function latestApplication(db: D1Database): Promise<ApplicationRow | null> {
  return db.prepare(`SELECT ${ALL_COLUMNS} FROM applications ORDER BY id DESC LIMIT 1`).first<ApplicationRow>();
}

export async function insertApplication(db: D1Database, fields: ApplicationFields, now: string): Promise<number> {
  const cols = ["status", "created_at", ...FIELD_COLUMNS];
  const r = await db
    .prepare(`INSERT INTO applications (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING id`)
    .bind("saved", now, ...FIELD_COLUMNS.map((c) => fields[c]))
    .first<{ id: number }>();
  if (!r) throw new Error("Insert returned no id.");
  return r.id;
}

/** Update the editable fields. Once applied, fit never changes (model section 9). */
export async function updateApplicationFields(db: D1Database, id: number, fields: ApplicationFields, applied: boolean): Promise<void> {
  const cols = FIELD_COLUMNS.filter((c) => !(applied && c === "fit"));
  await db
    .prepare(`UPDATE applications SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...cols.map((c) => fields[c]), id)
    .run();
}

export async function setTailored(db: D1Database, id: number, tailored: boolean): Promise<void> {
  await db.prepare(`UPDATE applications SET tailored = ? WHERE id = ?`).bind(tailored ? 1 : 0, id).run();
}

export async function setStatus(db: D1Database, id: number, status: "applied" | "withdrawn"): Promise<void> {
  await db.prepare(`UPDATE applications SET status = ? WHERE id = ?`).bind(status, id).run();
}

export async function keyExists(db: D1Database, key: string): Promise<boolean> {
  const r = await db.prepare(`SELECT 1 AS one FROM referral_keys WHERE key = ?`).bind(key).first<{ one: number }>();
  return r !== null;
}

/**
 * Apply: the referral_keys row and the application update in one batch
 * (D1 runs a batch as a transaction). Channel keys are untouched.
 */
export async function applyApplication(
  db: D1Database,
  app: { id: number; company: string; role_title: string | null },
  a: { key: string; versionId: string; assignedBy: "random" | "manual"; fit: number; effortMinutes: number; appliedAt: string }
): Promise<void> {
  const label = `${app.company} - ${app.role_title ?? "role"}`.slice(0, 200);
  await db.batch([
    db
      .prepare(`INSERT INTO referral_keys (key, label, company, role, channel, created_at, sent_at, active) VALUES (?, ?, ?, ?, 'application', ?, ?, 1)`)
      .bind(a.key, label, app.company, app.role_title, a.appliedAt, a.appliedAt),
    db
      .prepare(
        `UPDATE applications SET status = 'applied', key = ?, applied_at = ?, resume_version_id = ?, assigned_by = ?, fit = ?, effort_minutes = ? WHERE id = ? AND status = 'saved'`
      )
      .bind(a.key, a.appliedAt, a.versionId, a.assignedBy, a.fit, a.effortMinutes, app.id),
  ]);
}

// -- events ----------------------------------------------------------------------

export async function listEvents(db: D1Database, applicationId: number): Promise<ApplicationEventRow[]> {
  const r = await db
    .prepare(`SELECT id, application_id, type, at, auto, note FROM application_events WHERE application_id = ? ORDER BY at, id`)
    .bind(applicationId)
    .all<ApplicationEventRow>();
  return r.results ?? [];
}

export async function listAllEvents(db: D1Database): Promise<ApplicationEventRow[]> {
  const r = await db.prepare(`SELECT id, application_id, type, at, auto, note FROM application_events ORDER BY at, id`).all<ApplicationEventRow>();
  return r.results ?? [];
}

export async function insertEvent(db: D1Database, e: { application_id: number; type: EventType; at: string; auto: boolean; note: string | null }): Promise<void> {
  await db
    .prepare(`INSERT INTO application_events (application_id, type, at, auto, note) VALUES (?, ?, ?, ?, ?)`)
    .bind(e.application_id, e.type, e.at, e.auto ? 1 : 0, e.note)
    .run();
}

export async function deleteEvent(db: D1Database, applicationId: number, eventId: number): Promise<void> {
  await db.prepare(`DELETE FROM application_events WHERE id = ? AND application_id = ?`).bind(eventId, applicationId).run();
}

// -- sessions on keys ------------------------------------------------------------

interface KeyEventRow {
  session_id: string;
  key: string;
  event: string;
  ts: string;
  ua: string | null;
  cf_threat_score: number | null;
  has_js: number | null;
  payload: string | null;
  country: string | null;
}

/** Every session on the given keys, classified, newest first per key. */
export async function sessionsForKeys(db: D1Database, keys: string[]): Promise<Map<string, KeySession[]>> {
  const out = new Map<string, KeySession[]>();
  if (keys.length === 0) return out;
  const rows: KeyEventRow[] = [];
  // D1 binds at most 100 parameters per statement.
  for (let i = 0; i < keys.length; i += 90) {
    const chunk = keys.slice(i, i + 90);
    const r = await db
      .prepare(
        `SELECT session_id, key, event, ts, ua, cf_threat_score, has_js, payload, country FROM events WHERE key IN (${chunk.map(() => "?").join(",")}) ORDER BY ts, id`
      )
      .bind(...chunk)
      .all<KeyEventRow>();
    rows.push(...(r.results ?? []));
  }
  const bySession = new Map<string, KeyEventRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.session_id);
    if (list) list.push(row);
    else bySession.set(row.session_id, [row]);
  }
  for (const [sessionId, list] of bySession) {
    const visit = list.find((r) => r.event === "visit_server") ?? list[0];
    const session: KeySession = {
      sessionId,
      at: visit.ts,
      cls: classifySession(list),
      country: visit.country,
      events: list.map((r) => r.event),
    };
    const key = visit.key;
    const existing = out.get(key);
    if (existing) existing.push(session);
    else out.set(key, [session]);
  }
  for (const list of out.values()) list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return out;
}

// -- config ----------------------------------------------------------------------

export interface ConfigRow {
  name: string;
  value: number;
  changed_at: string;
}

const CONFIG_NAMES: Record<string, keyof StatsConfig> = { T_days: "tDays", V_days: "vDays", a0: "a0", b0: "b0", m: "m", floor: "floor" };
export const CONFIG_NAME_LIST = Object.keys(CONFIG_NAMES);

/** The latest row per name over the defaults. */
export async function loadConfig(db: D1Database): Promise<{ config: StatsConfig; rows: ConfigRow[] }> {
  const r = await db.prepare(`SELECT name, value, changed_at FROM stats_config ORDER BY id DESC`).all<ConfigRow>();
  const rows = r.results ?? [];
  const config: StatsConfig = { ...DEFAULT_CONFIG };
  const seen = new Set<string>();
  for (const row of rows) {
    const field = CONFIG_NAMES[row.name];
    if (!field || seen.has(row.name)) continue;
    seen.add(row.name);
    config[field] = row.value;
  }
  return { config, rows };
}

export async function appendConfig(db: D1Database, name: string, value: number, now: string): Promise<void> {
  if (!CONFIG_NAMES[name]) throw new Error(`Unknown config name ${name}.`);
  await db.prepare(`INSERT INTO stats_config (name, value, changed_at) VALUES (?, ?, ?)`).bind(name, value, now).run();
}

// -- adapters --------------------------------------------------------------------

export function toApplicationInput(row: ApplicationRow, events: ApplicationEventRow[], sessions: KeySession[]): ApplicationInput {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
    key: row.key,
    resumeVersionId: row.resume_version_id,
    assignedBy: row.assigned_by,
    tailored: row.tailored === 1,
    referral: row.referral === 1,
    fit: row.fit,
    effortMinutes: row.effort_minutes,
    coverLetter: row.cover_letter,
    company: row.company,
    companySizeBand: row.company_size_band,
    industry: row.industry,
    roleTitle: row.role_title,
    roleFamily: row.role_family,
    level: row.level,
    location: row.location,
    workMode: row.work_mode,
    ats: row.ats,
    sourceChannel: row.source_channel,
    postingAgeDays: row.posting_age_days,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryPeriod: row.salary_period,
    events: events.map((e) => ({ type: e.type, at: e.at, auto: e.auto === 1 })),
    sessions: sessions.map((s) => ({ at: s.at, cls: s.cls })),
  };
}

export function toVersionInput(v: ResumeVersion): ResumeVersionInput {
  return { id: v.id, label: v.label, status: v.status, factors: parseFactorsJson(v.factors), createdAt: v.created_at };
}

export interface StatsData {
  rows: ApplicationRow[];
  events: Map<number, ApplicationEventRow[]>;
  sessions: Map<string, KeySession[]>;
  inputs: ApplicationInput[];
  versions: ResumeVersion[];
  versionInputs: ResumeVersionInput[];
  config: StatsConfig;
  configRows: ConfigRow[];
}

/** Everything the list, detail and stats pages need, in four queries plus the key chunks. */
export async function loadStatsData(db: D1Database): Promise<StatsData> {
  const [rows, allEvents, versions, cfg] = await Promise.all([listApplications(db), listAllEvents(db), listVersions(db), loadConfig(db)]);
  const events = new Map<number, ApplicationEventRow[]>();
  for (const e of allEvents) {
    const list = events.get(e.application_id);
    if (list) list.push(e);
    else events.set(e.application_id, [e]);
  }
  const keys = rows.map((r) => r.key).filter((k): k is string => k !== null);
  const sessions = await sessionsForKeys(db, keys);
  const inputs = rows.map((r) => toApplicationInput(r, events.get(r.id) ?? [], r.key ? (sessions.get(r.key) ?? []) : []));
  return { rows, events, sessions, inputs, versions, versionInputs: versions.map(toVersionInput), config: cfg.config, configRows: cfg.rows };
}

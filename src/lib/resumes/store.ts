import type { ResumeStatus, ResumeVersion } from "./versions";

/** D1 access for resume_versions. */

export interface ResumeEnv {
  ANALYTICS_DB: D1Database;
  R2_ASSETS: R2Bucket;
}

const COLUMNS = "id, label, created_at, r2_key, content_hash, factors, status, notes";

export async function listVersions(db: D1Database): Promise<ResumeVersion[]> {
  const r = await db.prepare(`SELECT ${COLUMNS} FROM resume_versions ORDER BY created_at DESC, id`).all<ResumeVersion>();
  return r.results ?? [];
}

export async function getVersion(db: D1Database, id: string): Promise<ResumeVersion | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM resume_versions WHERE id = ?`).bind(id).first<ResumeVersion>();
}

export async function insertVersion(
  db: D1Database,
  v: { id: string; label: string; r2_key: string; content_hash: string; factors: Record<string, string>; status: ResumeStatus; notes: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO resume_versions (id, label, created_at, r2_key, content_hash, factors, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(v.id, v.label, new Date().toISOString(), v.r2_key, v.content_hash, JSON.stringify(v.factors), v.status, v.notes)
    .run();
}

export async function updateVersion(
  db: D1Database,
  id: string,
  v: { label: string; factors: Record<string, string>; status: ResumeStatus; notes: string | null }
): Promise<void> {
  await db
    .prepare(`UPDATE resume_versions SET label = ?, factors = ?, status = ?, notes = ? WHERE id = ?`)
    .bind(v.label, JSON.stringify(v.factors), v.status, v.notes, id)
    .run();
}

-- Phase 8: application tracking. Spec: docs/handoff/APPLICATION-STATS-MODEL.md
-- (section 2 records). referral_keys is not altered: an application that is
-- applied owns one referral_keys row (channel 'application').

-- One row per uploaded resume PDF. factors is a JSON object of factor name
-- to level, e.g. {"summary":"on","length":"1 page"}. At most 3 rows may be
-- live or default at once (enforced in code).
CREATE TABLE IF NOT EXISTS resume_versions (
  id            TEXT PRIMARY KEY,                 -- slug
  label         TEXT NOT NULL,
  created_at    TEXT NOT NULL,                    -- ISO
  r2_key        TEXT NOT NULL,                    -- resumes/<id>.pdf in R2_ASSETS
  content_hash  TEXT NOT NULL,                    -- SHA-256 hex of the uploaded bytes
  factors       TEXT NOT NULL DEFAULT '{}',       -- JSON object
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','default','retired')),
  notes         TEXT
);

-- One row per posting; saved rows have no key and no version until applied.
-- fit and assigned_by are NOT NULL once applied (enforced in code: the
-- columns stay nullable for saved rows).
CREATE TABLE IF NOT EXISTS applications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  key                TEXT UNIQUE REFERENCES referral_keys(key),
  status             TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','applied','withdrawn')),
  created_at         TEXT NOT NULL,
  -- posting
  company            TEXT NOT NULL,
  company_size_band  TEXT,
  industry           TEXT,
  role_title         TEXT,
  role_family        TEXT CHECK (role_family IS NULL OR role_family IN ('platform','ml','graphics','general swe','other')),
  level              TEXT CHECK (level IS NULL OR level IN ('intern','new grad','junior','mid')),
  location           TEXT,
  work_mode          TEXT CHECK (work_mode IS NULL OR work_mode IN ('onsite','hybrid','remote')),
  salary_min         REAL,
  salary_max         REAL,
  salary_period      TEXT,
  benefits           TEXT,                        -- free-text tags
  ats                TEXT CHECK (ats IS NULL OR ats IN ('greenhouse','lever','workday','ashby','icims','taleo','smartrecruiters','company-built','email','other')),
  source_channel     TEXT CHECK (source_channel IS NULL OR source_channel IN ('company site','linkedin','handshake','referral','career fair','recruiter inbound','other')),
  posted_at          TEXT,                        -- or first seen
  posting_age_days   INTEGER,                     -- at submission
  applicant_count    INTEGER,
  requisition_id     TEXT,
  posting_url        TEXT,
  -- submission
  applied_at         TEXT,                        -- ISO, null while saved
  referral           INTEGER NOT NULL DEFAULT 0,
  cover_letter       TEXT CHECK (cover_letter IS NULL OR cover_letter IN ('none','generic','tailored')),
  resume_version_id  TEXT REFERENCES resume_versions(id),
  assigned_by        TEXT CHECK (assigned_by IS NULL OR assigned_by IN ('random','manual')),
  tailored           INTEGER NOT NULL DEFAULT 0,
  fit                INTEGER CHECK (fit IS NULL OR fit BETWEEN 1 AND 5),  -- set before submitting, never edited
  effort_minutes     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_applied ON applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_applications_version ON applications(resume_version_id);
CREATE INDEX IF NOT EXISTS idx_applications_ats     ON applications(ats);

-- Append-only outcome log. The two link_visit types from the model are not
-- stored: they are derived from the key's sessions at read time.
CREATE TABLE IF NOT EXISTS application_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER NOT NULL REFERENCES applications(id),
  type            TEXT NOT NULL CHECK (type IN ('rejection','recruiter_contact','assessment_invite','phone_screen','interview','offer','withdrawn','followup_sent')),
  at              TEXT NOT NULL,                  -- ISO
  auto            INTEGER NOT NULL DEFAULT 0,     -- automatic assessment invites never count toward Y
  note            TEXT
);

CREATE INDEX IF NOT EXISTS idx_application_events_app ON application_events(application_id);

-- Model constants, append-only: readers take the latest row per name, so a
-- change to a definition keeps its date (model section 9).
CREATE TABLE IF NOT EXISTS stats_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  value       REAL NOT NULL,
  changed_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stats_config_name ON stats_config(name, id);

INSERT INTO stats_config (name, value, changed_at) VALUES
  ('T_days', 30,   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('V_days', 14,   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('a0',     0.5,  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b0',     9.5,  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('m',      10,   strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('floor',  0.20, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Now section items, edited from /admin/now. Replaces the hard-coded
-- src/content/now.ts entry, which stays as the render fallback.
CREATE TABLE IF NOT EXISTS now_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('reading','watching','playing','building')),
  title TEXT NOT NULL,
  subtitle TEXT,            -- author, studio, etc.
  isbn13 TEXT,
  note TEXT,
  url TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- Seed: the current book from src/content/now.ts. updated_at is unix ms.
INSERT INTO now_items (kind, title, subtitle, isbn13, note, url, sort, active, updated_at)
VALUES ('reading', 'Vengeful', 'V. E. Schwab', '9780765387547', NULL, NULL, 0, 1,
        CAST(strftime('%s', 'now') AS INTEGER) * 1000);

import type { ApplicationEventRow, ApplicationRow } from "./store";
import { FIELD_COLUMNS } from "./store";

/** CSV with RFC 4180 quoting; every value is quoted when it needs to be. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

const APP_COLUMNS = ["id", "key", "status", "created_at", "applied_at", "resume_version_id", "assigned_by", ...FIELD_COLUMNS] as const;
const EVENT_COLUMNS = ["id", "application_id", "type", "at", "auto", "note"] as const;

/**
 * Two tables in one file, each with its own header, separated by a blank
 * line: the input for the model's section 6 script. CRLF line endings.
 */
export function applicationsCsv(rows: ApplicationRow[], events: ApplicationEventRow[]): string {
  const lines: string[] = [];
  lines.push("# applications");
  lines.push(csvLine([...APP_COLUMNS]));
  for (const r of rows) lines.push(csvLine(APP_COLUMNS.map((c) => r[c])));
  lines.push("");
  lines.push("# application_events");
  lines.push(csvLine([...EVENT_COLUMNS]));
  for (const e of events) lines.push(csvLine(EVENT_COLUMNS.map((c) => e[c])));
  return lines.join("\r\n") + "\r\n";
}

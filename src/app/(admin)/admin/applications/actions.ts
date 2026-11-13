"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { performApply, type AppliedResult } from "@/lib/applications/apply";
import { applyErrors, EVENT_TYPES, parseApplicationFields, type EventType, type FieldErrors } from "@/lib/applications/fields";
import {
  type ApplicationEnv,
  deleteEvent,
  getApplication,
  insertApplication,
  insertEvent,
  setStatus,
  setTailored,
  updateApplicationFields,
} from "@/lib/applications/store";

export interface AppFormState {
  errors?: FieldErrors;
  ok?: boolean;
  applied?: AppliedResult;
}

export interface EventFormState {
  error?: string;
  ok?: boolean;
}

async function db(): Promise<D1Database> {
  return ((await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv).ANALYTICS_DB;
}

function idOf(fd: FormData): number | null {
  const n = Number(fd.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * New-application form. The submit button carries `intent`: "save" puts the
 * row in the backlog; "apply" also draws the version and mints the key.
 */
export async function createApplication(_prev: AppFormState, fd: FormData): Promise<AppFormState> {
  const now = new Date().toISOString();
  const { fields, errors } = parseApplicationFields(fd);
  const intent = str(fd, "intent") === "apply" ? "apply" : "save";
  if (intent === "apply") Object.assign(errors, applyErrors(fields));
  if (Object.keys(errors).length > 0) return { errors };

  const d = await db();
  const id = await insertApplication(d, fields, now);
  if (intent === "save") redirect("/admin/applications");

  const app = await getApplication(d, id);
  if (!app) return { errors: { form: "The row was not saved." } };
  const r = await performApply(d, app, {
    fit: fields.fit as number,
    effortMinutes: fields.effort_minutes as number,
    manualVersionId: str(fd, "manual_version") || null,
    now,
  });
  if ("error" in r) return { errors: { form: `Saved to the backlog as #${id}, but not applied: ${r.error}` } };
  return { ok: true, applied: r.result };
}

/** Edit an existing row. fit is ignored once applied (the store enforces it). */
export async function updateApplication(_prev: AppFormState, fd: FormData): Promise<AppFormState> {
  const id = idOf(fd);
  if (!id) return { errors: { form: "Missing id." } };
  const { fields, errors } = parseApplicationFields(fd);
  if (Object.keys(errors).length > 0) return { errors };
  const d = await db();
  const app = await getApplication(d, id);
  if (!app) return { errors: { form: "Application not found." } };
  await updateApplicationFields(d, id, fields, app.status !== "saved");
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}

/** Apply a backlog row from its page. */
export async function applyExisting(_prev: AppFormState, fd: FormData): Promise<AppFormState> {
  const id = idOf(fd);
  if (!id) return { errors: { form: "Missing id." } };
  const errors: FieldErrors = {};
  const fit = Number(str(fd, "fit"));
  const effort = Number(str(fd, "effort_minutes"));
  if (!Number.isInteger(fit) || fit < 1 || fit > 5) errors.fit = "Fit (1 to 5) is required to apply.";
  if (!Number.isInteger(effort) || effort < 0 || str(fd, "effort_minutes") === "") errors.effort_minutes = "Effort minutes are required to apply.";
  if (Object.keys(errors).length > 0) return { errors };

  const d = await db();
  const app = await getApplication(d, id);
  if (!app) return { errors: { form: "Application not found." } };
  const r = await performApply(d, app, { fit, effortMinutes: effort, manualVersionId: str(fd, "manual_version") || null, now: new Date().toISOString() });
  if ("error" in r) return { errors: { form: r.error } };
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true, applied: r.result };
}

export async function toggleTailored(fd: FormData): Promise<void> {
  const id = idOf(fd);
  if (!id) return;
  const d = await db();
  const app = await getApplication(d, id);
  if (!app) return;
  await setTailored(d, id, app.tailored !== 1);
  revalidatePath(`/admin/applications/${id}`);
}

/** Add an outcome event. A withdrawn event also sets the row's status. */
export async function addEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const id = idOf(fd);
  if (!id) return { error: "Missing id." };
  const type = str(fd, "type");
  if (!(EVENT_TYPES as readonly string[]).includes(type)) return { error: "Choose an event type." };
  const date = str(fd, "at");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: "Date must be YYYY-MM-DD." };
  // A date-only entry gets the current UTC time of day so same-day ordering follows entry order.
  const at = date === new Date().toISOString().slice(0, 10) ? new Date().toISOString() : `${date}T12:00:00.000Z`;
  const note = str(fd, "note").slice(0, 1000) || null;
  const d = await db();
  const app = await getApplication(d, id);
  if (!app) return { error: "Application not found." };
  if (app.status === "saved") return { error: "Apply first; events belong to a submitted application." };
  await insertEvent(d, { application_id: id, type: type as EventType, at, auto: fd.get("auto") !== null, note });
  if (type === "withdrawn") await setStatus(d, id, "withdrawn");
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}

export async function removeEvent(fd: FormData): Promise<void> {
  const id = idOf(fd);
  const eventId = Number(fd.get("event_id"));
  if (!id || !Number.isInteger(eventId)) return;
  await deleteEvent(await db(), id, eventId);
  revalidatePath(`/admin/applications/${id}`);
}

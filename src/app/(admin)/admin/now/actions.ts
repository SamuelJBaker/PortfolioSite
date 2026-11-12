"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { isNowKind, type NowKind } from "@/lib/now";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

interface NowFields {
  kind: NowKind;
  title: string;
  subtitle: string | null;
  isbn13: string | null;
  note: string | null;
  url: string | null;
  sort: number;
  active: number;
}

const MAX_TEXT = 500;

async function db() {
  const ctx = await getCloudflareContext({ async: true });
  return (ctx.env as unknown as CloudflareEnv).ANALYTICS_DB;
}

function text(formData: FormData, name: string, max = MAX_TEXT): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/** Validate the shared form fields; throws on bad input so the form shows the error. */
function readFields(formData: FormData): NowFields {
  const kind = formData.get("kind");
  if (!isNowKind(kind)) throw new Error("Invalid kind.");

  const title = text(formData, "title", 200);
  if (!title) throw new Error("Title is required.");

  const isbn13 = text(formData, "isbn13", 32)?.replace(/[^0-9Xx]/g, "") ?? null;
  if (isbn13 && isbn13.length !== 13 && isbn13.length !== 10) {
    throw new Error("ISBN must be 10 or 13 characters.");
  }

  const url = text(formData, "url", 2048);
  if (url && !/^https?:\/\//i.test(url)) throw new Error("URL must start with http:// or https://.");

  const sortRaw = Number(formData.get("sort") ?? 0);
  const sort = Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0;

  return {
    kind,
    title,
    subtitle: text(formData, "subtitle", 200),
    isbn13: isbn13 || null,
    note: text(formData, "note"),
    url,
    sort,
    active: formData.get("active") === "on" ? 1 : 0,
  };
}

function readId(formData: FormData): number {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id.");
  return id;
}

export async function createNowItem(formData: FormData) {
  const f = readFields(formData);
  await (await db())
    .prepare(
      `INSERT INTO now_items (kind, title, subtitle, isbn13, note, url, sort, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(f.kind, f.title, f.subtitle, f.isbn13, f.note, f.url, f.sort, f.active, Date.now())
    .run();
  redirect("/admin/now");
}

export async function updateNowItem(formData: FormData) {
  const id = readId(formData);
  const f = readFields(formData);
  await (await db())
    .prepare(
      `UPDATE now_items
       SET kind = ?, title = ?, subtitle = ?, isbn13 = ?, note = ?, url = ?, sort = ?, active = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(f.kind, f.title, f.subtitle, f.isbn13, f.note, f.url, f.sort, f.active, Date.now(), id)
    .run();
  redirect("/admin/now");
}

/** Soft delete: the row stays for history, /api/now stops returning it. */
export async function deleteNowItem(formData: FormData) {
  const id = readId(formData);
  await (await db())
    .prepare("UPDATE now_items SET active = 0, updated_at = ? WHERE id = ?")
    .bind(Date.now(), id)
    .run();
  redirect("/admin/now");
}

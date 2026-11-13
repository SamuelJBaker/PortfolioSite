"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { countPlaceholderLinks, PLACEHOLDER_URI, sha256Hex } from "@/lib/resumes/pdf";
import { getVersion, insertVersion, listVersions, type ResumeEnv, updateVersion } from "@/lib/resumes/store";
import { activeLimitError, isResumeStatus, parseFactors, r2KeyFor, slugify, VERSION_ID_PATTERN } from "@/lib/resumes/versions";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function env(): Promise<ResumeEnv> {
  return (await getCloudflareContext({ async: true })).env as unknown as ResumeEnv;
}

function text(formData: FormData, name: string, max = 500): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Create a version from an uploaded PDF. Returns an inline error instead of throwing. */
export async function createVersion(_prev: FormState, formData: FormData): Promise<FormState> {
  const label = text(formData, "label", 120);
  if (!label) return { error: "Label is required." };
  const id = text(formData, "id", 64) || slugify(label);
  if (!VERSION_ID_PATTERN.test(id)) return { error: "Id must be lowercase letters, digits and dashes." };

  const status = text(formData, "status") || "live";
  if (!isResumeStatus(status)) return { error: "Invalid status." };

  const parsed = parseFactors(text(formData, "factors", 2000));
  if ("error" in parsed) return { error: parsed.error };
  const notes = text(formData, "notes", 2000) || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF." };
  if (file.size > MAX_PDF_BYTES) return { error: "PDF is larger than 10 MB." };
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return { error: "The file must be a PDF." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  let links: number;
  try {
    links = await countPlaceholderLinks(bytes);
  } catch {
    return { error: "The file could not be read as a PDF." };
  }
  if (links === 0) {
    return { error: `The PDF must contain at least one link to ${PLACEHOLDER_URI}; found 0 (link annotations with that exact URI).` };
  }

  const { ANALYTICS_DB: db, R2_ASSETS: bucket } = await env();
  const existing = await listVersions(db);
  if (existing.some((v) => v.id === id)) return { error: `A version with id "${id}" already exists.` };
  const limit = activeLimitError(existing, id, status);
  if (limit) return { error: limit };

  const r2_key = r2KeyFor(id);
  // No immutable cache header: the object is read back by the stamping route, never served as-is.
  await bucket.put(r2_key, file, { httpMetadata: { contentType: "application/pdf" } });
  await insertVersion(db, { id, label, r2_key, content_hash: await sha256Hex(bytes), factors: parsed.factors, status, notes });

  redirect("/admin/resumes");
}

/** Edit label, factors, notes and status of a version. */
export async function editVersion(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id", 64);
  const label = text(formData, "label", 120);
  if (!label) return { error: "Label is required." };
  const status = text(formData, "status");
  if (!isResumeStatus(status)) return { error: "Invalid status." };
  const parsed = parseFactors(text(formData, "factors", 2000));
  if ("error" in parsed) return { error: parsed.error };
  const notes = text(formData, "notes", 2000) || null;

  const { ANALYTICS_DB: db } = await env();
  const current = await getVersion(db, id);
  if (!current) return { error: "Version not found." };
  const limit = activeLimitError(await listVersions(db), id, status);
  if (limit) return { error: limit };

  await updateVersion(db, id, { label, factors: parsed.factors, status, notes });
  revalidatePath("/admin/resumes");
  return { ok: true };
}

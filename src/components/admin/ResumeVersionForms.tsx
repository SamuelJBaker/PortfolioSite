"use client";

import * as React from "react";
import type { FormState } from "@/app/(admin)/admin/resumes/actions";
import { RESUME_STATUSES, type ResumeVersion } from "@/lib/resumes/versions";

const INPUT =
  "w-full rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-accent/45";
const LABEL = "block text-xs text-muted mb-1";
const BUTTON =
  "rounded-xl border border-accent/45 bg-accent/10 px-4 py-1.5 text-sm text-accent-text hover:bg-accent/15 transition disabled:opacity-50";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Status({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return <p className="text-xs text-neutral-500">Working...</p>;
  if (state.error) return <p className="text-sm text-red-400" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-xs text-green-400">Saved.</p>;
  return null;
}

function StatusSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="status" defaultValue={defaultValue} className={INPUT}>
      {RESUME_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function NewVersionForm({ action }: { action: Action }) {
  const [state, formAction, pending] = React.useActionState(action, {});
  return (
    <form action={formAction} className="rounded-2xl border border-line bg-panel/35 p-5 space-y-3 max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Label</label>
          <input name="label" required placeholder="v2 summary on" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Id (slug, from the label when blank)</label>
          <input name="id" placeholder="v2-summary-on" pattern="[a-z0-9][a-z0-9-]*" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>PDF with a link to https://samueljbaker.dev/v/__KEY__</label>
          <input name="file" type="file" accept="application/pdf,.pdf" required className="block w-full text-sm text-body file:mr-3 file:rounded-lg file:border file:border-line file:bg-panel/60 file:px-3 file:py-1 file:text-xs file:text-neutral-200" />
        </div>
        <div>
          <label className={LABEL}>Status</label>
          <StatusSelect defaultValue="live" />
        </div>
        <div>
          <label className={LABEL}>Factors, one name=level per line</label>
          <textarea name="factors" rows={3} placeholder={"summary=on\nproject_order=ecs-first\nlength=1 page"} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea name="notes" rows={3} className={INPUT} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <Status state={state} pending={pending} />
        <button type="submit" disabled={pending} className={BUTTON}>
          Upload version
        </button>
      </div>
    </form>
  );
}

export function EditVersionForm({ version, factorsText, action, applications }: { version: ResumeVersion; factorsText: string; action: Action; applications: number }) {
  const [state, formAction, pending] = React.useActionState(action, {});
  return (
    <form action={formAction} className={"rounded-2xl border border-line bg-panel/35 p-5" + (version.status === "retired" ? " opacity-60" : "")}>
      <input type="hidden" name="id" value={version.id} />
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <span className="font-mono text-xs text-neutral-400">{version.id}</span>
        <span className="text-xs text-neutral-500">
          {applications} application{applications === 1 ? "" : "s"} &middot; created {version.created_at.slice(0, 10)} &middot; sha256 {version.content_hash.slice(0, 12)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL}>Label</label>
          <input name="label" defaultValue={version.label} required className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Status</label>
          <StatusSelect defaultValue={version.status} />
        </div>
        <div>
          <label className={LABEL}>Factors</label>
          <textarea name="factors" rows={2} defaultValue={factorsText} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Notes</label>
          <textarea name="notes" rows={2} defaultValue={version.notes ?? ""} className={INPUT} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <Status state={state} pending={pending} />
        <button type="submit" disabled={pending} className={BUTTON}>
          Save
        </button>
      </div>
    </form>
  );
}

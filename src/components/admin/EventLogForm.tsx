"use client";

import * as React from "react";
import type { EventFormState } from "@/app/(admin)/admin/applications/actions";
import { EVENT_TYPES } from "@/lib/applications/fields";
import { BUTTON, INPUT, LABEL } from "./ApplicationForm";

type Action = (prev: EventFormState, fd: FormData) => Promise<EventFormState>;

/** One-row add form for the outcome log; errors inline. */
export function EventLogForm({ id, action, today }: { id: number; action: Action; today: string }) {
  const [state, formAction, pending] = React.useActionState(action, {});
  return (
    <form action={formAction} className="rounded-2xl border border-line bg-panel/35 p-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_2fr_auto] items-end">
        <div>
          <label className={LABEL} htmlFor="e-type">Type</label>
          <select id="e-type" name="type" defaultValue="" required className={INPUT}>
            <option value="">-</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="e-at">Date</label>
          <input id="e-at" name="at" type="date" defaultValue={today} required className={INPUT} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-body">
          <input type="checkbox" name="auto" className="h-4 w-4 rounded border border-neutral-700 bg-panel accent-accent" />
          auto
        </label>
        <div>
          <label className={LABEL} htmlFor="e-note">Note</label>
          <input id="e-note" name="note" className={INPUT} />
        </div>
        <button type="submit" disabled={pending} className={BUTTON}>
          Add
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-400" role="alert">{state.error}</p>}
      {state.ok && !pending && <p className="mt-2 text-xs text-green-400">Added.</p>}
    </form>
  );
}

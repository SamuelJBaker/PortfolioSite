"use client";

import * as React from "react";
import type { ConfigFormState } from "@/app/(admin)/admin/stats/actions";
import { BUTTON, INPUT, LABEL } from "./ApplicationForm";

type Action = (prev: ConfigFormState, fd: FormData) => Promise<ConfigFormState>;

export function StatsConfigForm({ names, current, action }: { names: string[]; current: Record<string, number>; action: Action }) {
  const [state, formAction, pending] = React.useActionState(action, {});
  const [name, setName] = React.useState(names[0] ?? "");
  return (
    <form action={formAction} className="rounded-2xl border border-line bg-panel/35 p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className={LABEL} htmlFor="c-name">Setting</label>
        <select id="c-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT}>
          {names.map((n) => (
            <option key={n} value={n}>
              {n} (now {current[n]})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL} htmlFor="c-value">New value</label>
        <input id="c-value" name="value" type="number" step="any" key={name} defaultValue={current[name]} className={INPUT} />
      </div>
      <button type="submit" disabled={pending} className={BUTTON}>
        Append
      </button>
      {state.error && <p className="text-sm text-red-400" role="alert">{state.error}</p>}
      {state.ok && !pending && <p className="text-xs text-green-400">Written.</p>}
    </form>
  );
}

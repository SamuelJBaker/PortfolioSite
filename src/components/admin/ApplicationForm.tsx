"use client";

import * as React from "react";
import type { AppFormState } from "@/app/(admin)/admin/applications/actions";
import type { AppliedResult } from "@/lib/applications/apply";
import {
  ATS_VALUES,
  atsFromUrl,
  COMPANY_SIZE_BANDS,
  COVER_LETTERS,
  LEVELS,
  ROLE_FAMILIES,
  SALARY_PERIODS,
  SOURCE_CHANNELS,
  WORK_MODES,
  type ApplicationFields,
  type FieldErrors,
} from "@/lib/applications/fields";

export const INPUT =
  "w-full rounded-lg border border-line bg-panel/60 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-accent/45 disabled:opacity-50";
export const LABEL = "block text-xs text-muted mb-1";
export const BUTTON =
  "rounded-xl border border-accent/45 bg-accent/10 px-4 py-1.5 text-sm text-accent-text hover:bg-accent/15 transition disabled:opacity-50";
export const BUTTON_QUIET = "rounded-xl border border-line bg-panel/40 px-4 py-1.5 text-sm text-neutral-200 hover:bg-panel/60 transition disabled:opacity-50";

type Action = (prev: AppFormState, fd: FormData) => Promise<AppFormState>;

export interface VersionOption {
  id: string;
  label: string;
  status: string;
}

function Err({ errors, name }: { errors?: FieldErrors; name: keyof FieldErrors }) {
  const e = errors?.[name];
  return e ? <p className="mt-1 text-xs text-red-400">{e}</p> : null;
}

function Field({
  label,
  name,
  defaults,
  errors,
  type = "text",
  placeholder,
  disabled,
  span,
}: {
  label: string;
  name: keyof ApplicationFields;
  defaults: Partial<ApplicationFields>;
  errors?: FieldErrors;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  span?: string;
}) {
  const v = defaults[name];
  return (
    <div className={span}>
      <label className={LABEL} htmlFor={`f-${name}`}>
        {label}
      </label>
      <input id={`f-${name}`} name={name} type={type} defaultValue={v === null || v === undefined ? "" : String(v)} placeholder={placeholder} disabled={disabled} className={INPUT} />
      <Err errors={errors} name={name} />
    </div>
  );
}

function Select({
  label,
  name,
  values,
  defaults,
  errors,
  disabled,
  onChange,
  selectRef,
}: {
  label: string;
  name: keyof ApplicationFields;
  values: readonly string[];
  defaults: Partial<ApplicationFields>;
  errors?: FieldErrors;
  disabled?: boolean;
  onChange?: () => void;
  selectRef?: React.Ref<HTMLSelectElement>;
}) {
  const v = defaults[name];
  return (
    <div>
      <label className={LABEL} htmlFor={`f-${name}`}>
        {label}
      </label>
      <select id={`f-${name}`} name={name} ref={selectRef} defaultValue={v === null || v === undefined ? "" : String(v)} disabled={disabled} onChange={onChange} className={INPUT}>
        <option value="">-</option>
        {values.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <Err errors={errors} name={name} />
    </div>
  );
}

function Check({ label, name, defaults, disabled }: { label: string; name: keyof ApplicationFields; defaults: Partial<ApplicationFields>; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-body pt-5">
      <input type="checkbox" name={name} defaultChecked={defaults[name] === 1} disabled={disabled} className="h-4 w-4 rounded border border-neutral-700 bg-panel accent-accent" />
      {label}
    </label>
  );
}

/** The result panel after Apply: link, version, draws, stamped PDF. */
export function AppliedPanel({ applied }: { applied: AppliedResult }) {
  const link = `https://samueljbaker.dev/v/${applied.key}`;
  const draws = Object.entries(applied.draws).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-accent/45 bg-accent/10 p-5 space-y-3" data-testid="applied-panel">
      <p className="text-sm text-neutral-100">
        Applied as <a href={`/admin/applications/${applied.id}`} className="text-accent-text underline">#{applied.id}</a>.
      </p>
      <p className="text-sm">
        <span className="text-muted">Short link </span>
        <span className="font-mono text-neutral-100 select-all" data-testid="applied-link">{link}</span>
      </p>
      <p className="text-sm">
        <span className="text-muted">Resume version </span>
        <span className="text-neutral-100">{applied.versionLabel}</span>
        <span className="text-muted">
          {" "}
          ({applied.reason === "manual" ? "chosen by hand" : applied.reason === "floor" ? "floor: under 20 percent of the last 20" : applied.reason === "single" ? "only live version" : "largest draw"})
        </span>
      </p>
      {draws.length > 0 && (
        <ul className="text-xs font-mono text-body space-y-0.5">
          {draws.map(([id, d]) => (
            <li key={id}>
              {(applied.labels[id] ?? id).padEnd(24)} {d.toFixed(4)}
              {id === applied.versionId ? "  <- sent" : ""}
            </li>
          ))}
        </ul>
      )}
      <a href={`/api/admin/applications/${applied.id}/resume.pdf`} className={BUTTON + " inline-block"}>
        Download stamped PDF
      </a>
    </div>
  );
}

/**
 * The posting and submission fields. mode "new": two submit buttons (backlog
 * or apply). mode "edit": one Save; fit is locked once applied.
 */
export function ApplicationForm({
  mode,
  defaults,
  applied,
  versions,
  action,
  id,
}: {
  mode: "new" | "edit";
  defaults: Partial<ApplicationFields>;
  /** Locks fit (edit mode of an applied row). */
  applied?: boolean;
  versions: VersionOption[];
  action: Action;
  id?: number;
}) {
  const [state, formAction, pending] = React.useActionState(action, {});
  const atsRef = React.useRef<HTMLSelectElement>(null);
  const atsManual = React.useRef(false);
  const errors = state.errors;

  // Posting URL on blur fills ATS from the host unless the select was chosen by hand.
  const onUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const ats = atsFromUrl(e.target.value);
    if (ats && atsRef.current && !atsManual.current) atsRef.current.value = ats;
  };

  if (state.applied) return <AppliedPanel applied={state.applied} />;

  return (
    <form action={formAction} className="space-y-5">
      {id !== undefined && <input type="hidden" name="id" value={id} />}
      {errors?.form && (
        <p className="text-sm text-red-400" role="alert">
          {errors.form}
        </p>
      )}

      <fieldset className="rounded-2xl border border-line bg-panel/35 p-5">
        <legend className="px-2 text-xs uppercase tracking-widest text-muted">Posting</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={LABEL} htmlFor="f-posting_url">
              Posting URL
            </label>
            <input id="f-posting_url" name="posting_url" type="url" defaultValue={defaults.posting_url ?? ""} placeholder="https://boards.greenhouse.io/..." onBlur={onUrlBlur} autoFocus={mode === "new"} className={INPUT} />
            <Err errors={errors} name="posting_url" />
          </div>
          <Field label="Company" name="company" defaults={defaults} errors={errors} />
          <Field label="Role title" name="role_title" defaults={defaults} errors={errors} />
          <Select label="Role family" name="role_family" values={ROLE_FAMILIES} defaults={defaults} errors={errors} />
          <Select label="Level" name="level" values={LEVELS} defaults={defaults} errors={errors} />
          <Select
            label="ATS"
            name="ats"
            values={ATS_VALUES}
            defaults={defaults}
            errors={errors}
            selectRef={atsRef}
            onChange={() => {
              atsManual.current = true;
            }}
          />
          <Select label="Source channel" name="source_channel" values={SOURCE_CHANNELS} defaults={defaults} errors={errors} />
          <Select label="Work mode" name="work_mode" values={WORK_MODES} defaults={defaults} errors={errors} />
          <Field label="Location" name="location" defaults={defaults} errors={errors} />
          <Select label="Company size" name="company_size_band" values={COMPANY_SIZE_BANDS} defaults={defaults} errors={errors} />
          <Field label="Industry" name="industry" defaults={defaults} errors={errors} />
          <Field label="Posted on" name="posted_at" type="date" defaults={{ posted_at: defaults.posted_at?.slice(0, 10) ?? null }} errors={errors} />
          <Field label="Posting age (days, from the date when blank)" name="posting_age_days" type="number" defaults={defaults} errors={errors} />
          <Field label="Salary min" name="salary_min" type="number" defaults={defaults} errors={errors} />
          <Field label="Salary max" name="salary_max" type="number" defaults={defaults} errors={errors} />
          <Select label="Salary period" name="salary_period" values={SALARY_PERIODS} defaults={defaults} errors={errors} />
          <Field label="Applicant count" name="applicant_count" type="number" defaults={defaults} errors={errors} />
          <Field label="Requisition id" name="requisition_id" defaults={defaults} errors={errors} />
          <Field label="Benefits (tags)" name="benefits" defaults={defaults} errors={errors} span="sm:col-span-2" />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-panel/35 p-5">
        <legend className="px-2 text-xs uppercase tracking-widest text-muted">Submission</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={applied ? "Fit (locked once applied)" : "Fit 1-5, before submitting"} name="fit" type="number" defaults={defaults} errors={errors} disabled={applied} />
          <Field label="Effort minutes" name="effort_minutes" type="number" defaults={defaults} errors={errors} />
          <Select label="Cover letter" name="cover_letter" values={COVER_LETTERS} defaults={defaults} errors={errors} />
          <div className="flex gap-6">
            <Check label="Referral" name="referral" defaults={defaults} />
            {mode === "new" && <Check label="Tailored" name="tailored" defaults={defaults} />}
          </div>
          {mode === "new" && (
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="f-manual_version">
                Resume version (blank: drawn by the system)
              </label>
              <select id="f-manual_version" name="manual_version" defaultValue="" className={INPUT}>
                <option value="">drawn (Thompson sampling)</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {mode === "new" ? (
          <>
            <button type="submit" name="intent" value="save" disabled={pending} className={BUTTON_QUIET}>
              Save to backlog
            </button>
            <button type="submit" name="intent" value="apply" disabled={pending} className={BUTTON}>
              Apply
            </button>
          </>
        ) : (
          <button type="submit" disabled={pending} className={BUTTON}>
            Save
          </button>
        )}
        {pending && <span className="text-xs text-neutral-500">Working...</span>}
        {state.ok && !pending && <span className="text-xs text-green-400">Saved.</span>}
      </div>
    </form>
  );
}

/** Apply a backlog row from its page: fit, effort, optional manual version. */
export function ApplyExistingForm({ id, defaults, versions, action }: { id: number; defaults: Partial<ApplicationFields>; versions: VersionOption[]; action: Action }) {
  const [state, formAction, pending] = React.useActionState(action, {});
  if (state.applied) return <AppliedPanel applied={state.applied} />;
  return (
    <form action={formAction} className="rounded-2xl border border-accent/30 bg-panel/35 p-5">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-neutral-100 mb-3">Apply from the backlog</p>
      {state.errors?.form && <p className="text-sm text-red-400 mb-2" role="alert">{state.errors.form}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="a-fit">Fit 1-5, before submitting</label>
          <input id="a-fit" name="fit" type="number" min={1} max={5} defaultValue={defaults.fit ?? ""} className={INPUT} />
          <Err errors={state.errors} name="fit" />
        </div>
        <div>
          <label className={LABEL} htmlFor="a-effort">Effort minutes</label>
          <input id="a-effort" name="effort_minutes" type="number" min={0} defaultValue={defaults.effort_minutes ?? ""} className={INPUT} />
          <Err errors={state.errors} name="effort_minutes" />
        </div>
        <div>
          <label className={LABEL} htmlFor="a-version">Resume version</label>
          <select id="a-version" name="manual_version" defaultValue="" className={INPUT}>
            <option value="">drawn (Thompson sampling)</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.status})
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" disabled={pending} className={BUTTON + " mt-4"}>
        Apply
      </button>
    </form>
  );
}

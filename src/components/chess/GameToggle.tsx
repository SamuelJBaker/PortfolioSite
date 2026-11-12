"use client";

import * as React from "react";

/** Two-way segmented control (also used for the chart scale). */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-panel/40 p-0.5 text-xs">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={
              "rounded-md px-2 py-1 transition " +
              (active ? "bg-line text-neutral-100" : "text-muted hover:text-neutral-100")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

/**
 * role="tablist" with automatic activation: arrow keys move focus and select,
 * Home and End jump. Panels are the caller's; they get the matching ids.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  idPrefix,
  label,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (v: T) => void;
  idPrefix: string;
  label: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const map: Record<string, number> = {
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      const next = map[e.key];
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-line bg-panel/40 p-0.5 text-xs">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={"rounded-md px-2.5 py-1 transition " + (active ? "bg-line text-neutral-100" : "text-muted hover:text-neutral-100")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

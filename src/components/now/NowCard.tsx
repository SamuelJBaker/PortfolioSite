import * as React from "react";

/**
 * Shell for the Now cards. With `media`, the body renders as a media row
 * (thumbnail left, text right); without it, children render directly under
 * the title.
 */
export function NowCard({
  title,
  media,
  footer,
  aside,
  children,
}: {
  title: string;
  media?: React.ReactNode;
  footer?: React.ReactNode;
  /** Rendered at the right of the title row, e.g. tabs. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel/25 p-6">
      {aside ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-neutral-200">{title}</p>
          {aside}
        </div>
      ) : (
        <p className="text-sm font-medium text-neutral-200">{title}</p>
      )}
      {media ? (
        <div className="mt-4 flex gap-4">
          {media}
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
      {footer}
    </div>
  );
}

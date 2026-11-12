"use client";

import * as React from "react";
import { now } from "../../content";
import type { NowResponse } from "../../lib/now";
import { NowCard } from "./NowCard";

interface Reading {
  title: string;
  author: string;
  isbn13: string;
  note: string;
  url?: string;
}

// The static fallback renders on the server and on first paint, so / stays a
// static page; the D1-backed row replaces it after mount when /api/now answers.
const FALLBACK: Reading = {
  title: now.reading.title,
  author: now.reading.author,
  isbn13: now.reading.isbn13,
  note: now.reading.note,
};

function coverUrlFromIsbn(isbn13: string) {
  // Open Library Covers API (append ?default=false to get 404 if missing)
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn13)}-L.jpg?default=false`;
}

export function NowReading() {
  const [reading, setReading] = React.useState<Reading>(FALLBACK);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/now");
        if (!res.ok) return;
        const data = (await res.json()) as NowResponse;
        const item = data.items.find((i) => i.kind === "reading" && i.active === 1);
        if (!item || cancelled) return;
        setReading({
          title: item.title,
          author: item.subtitle ?? "",
          isbn13: item.isbn13 ?? "",
          note: item.note ?? "",
          url: item.url ?? undefined,
        });
      } catch {
        // Keep the fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NowCard
      title="What I am reading"
      media={
        <div className="h-20 w-14 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
          {reading.isbn13 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={reading.isbn13}
              src={coverUrlFromIsbn(reading.isbn13)}
              alt={`Cover of ${reading.title}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>
      }
    >
      <p className="text-sm text-body">
        {reading.url ? (
          <a
            href={reading.url}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-100 hover:text-accent-text transition"
          >
            {reading.title}
          </a>
        ) : (
          <span className="text-neutral-100">{reading.title}</span>
        )}
        {reading.author ? ` by ${reading.author}` : ""}
      </p>
      <p className="mt-3 text-sm text-muted">{reading.note}</p>
    </NowCard>
  );
}

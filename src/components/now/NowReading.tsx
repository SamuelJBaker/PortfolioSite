"use client";

import * as React from "react";
import { now } from "../../content";
import { NowCard } from "./NowCard";

const NOW_READING = now.reading;

function coverUrlFromIsbn(isbn13: string) {
  // Open Library Covers API (append ?default=false to get 404 if missing)
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn13)}-L.jpg?default=false`;
}

export function NowReading() {
  return (
    <NowCard
      title="What I am reading"
      media={
        <div className="h-20 w-14 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrlFromIsbn(NOW_READING.isbn13)}
            alt={`Cover of ${NOW_READING.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      }
    >
      <p className="text-sm text-body">
        <span className="text-neutral-100">{NOW_READING.title}</span>
        {NOW_READING.author ? ` by ${NOW_READING.author}` : ""}
      </p>
      <p className="mt-3 text-sm text-muted">{NOW_READING.note}</p>
    </NowCard>
  );
}

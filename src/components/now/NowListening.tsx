"use client";

import * as React from "react";
import { classNames } from "../../lib/classNames";
import { ExternalLinkIcon } from "../icons";
import { NowCard } from "./NowCard";

const NOW_LISTENING_FALLBACK = "Last.fm now playing unavailable.";

export function NowListening() {
  const [state, setState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    text: string;
    href?: string;
    imageUrl?: string;
    isPlaying?: boolean;
  }>({
    status: "idle",
    text: NOW_LISTENING_FALLBACK,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setState((prev) =>
          prev.status === "ready" ? prev : { ...prev, status: "loading", text: "Loading now playing\u2026" }
        );

        const res = await fetch("/api/now-playing", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          isPlaying?: boolean;
          title?: string;
          artist?: string;
          trackUrl?: string;
          imageUrl?: string;
        };

        if (cancelled) return;

        if (!data?.title) {
          setState({ status: "ready", text: "No recent track found.", isPlaying: false });
          return;
        }

        const base = data.artist ? `${data.title} by ${data.artist}` : data.title;
        const text = data.isPlaying ? base : `Last played: ${base}`;

        setState({
          status: "ready",
          text,
          href: data.trackUrl,
          imageUrl: data.imageUrl,
          isPlaying: !!data.isPlaying,
        });
      } catch {
        if (!cancelled) setState({ status: "error", text: NOW_LISTENING_FALLBACK });
      }
    }

    run();
    const timer = setInterval(run, 15_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <NowCard
      title="What I am listening to"
      footer={<p className="mt-3 text-xs text-neutral-500">Powered by Last.fm.</p>}
    >
      <div className="mt-2 flex items-start gap-3 text-sm text-body">
        <div className="h-12 w-12 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
          {state.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.imageUrl}
              alt="Album art"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          {state.isPlaying ? (
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="uppercase tracking-widest">Live</span>
            </div>
          ) : null}

          <div className="min-w-0">
            {state.href ? (
              <a
                href={state.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-accent/90 hover:text-accent"
                title="Open in Last.fm"
              >
                <span className="truncate">{state.text}</span>
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            ) : (
              <span className={classNames(state.status === "loading" && "text-muted")}>
                {state.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </NowCard>
  );
}

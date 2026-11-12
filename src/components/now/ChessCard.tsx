"use client";

import * as React from "react";
import { chess, chessProfileUrl } from "../../content/chess";
import { dayLabel, formatDelta, lastGameLine, monthLabel } from "../../lib/chess/format";
import type { ChessSummary } from "../../lib/chess/types";
import { ExternalLinkIcon } from "../icons";
import { ChessBoardSvg } from "./ChessBoardSvg";
import { NowCard } from "./NowCard";
import { RatingSparkline } from "./RatingSparkline";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: ChessSummary };

const TITLE = "What I am playing";
const BODY_MIN_H = "min-h-[17rem]";

function Delta({ label, value }: { label: string; value: number | null }) {
  const tone = value !== null && value > 0 ? "text-accent" : "text-muted";
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={"mt-0.5 font-mono text-sm " + tone}>{formatDelta(value)}</p>
    </div>
  );
}

function Footer() {
  return (
    <p className="mt-4 text-xs text-neutral-500">
      Data from chess.com. Updates about daily.{" "}
      <a href={chessProfileUrl} target="_blank" rel="noreferrer" className="text-accent/70 hover:text-accent">
        {chess.displayName}
      </a>
    </p>
  );
}

/** Static placeholder at the ready layout's height; no opacity animation. */
function Skeleton() {
  return (
    <div className={"mt-4 flex flex-col gap-6 sm:flex-row " + BODY_MIN_H} aria-busy="true" aria-label="Loading chess stats">
      <div className="h-40 w-40 shrink-0 rounded-xl border border-line bg-neutral-950/40" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-8 w-28 rounded bg-line" />
        <div className="h-3 w-40 rounded bg-line/70" />
        <div className="h-16 w-full rounded bg-line/40" />
        <div className="h-3 w-56 rounded bg-line/70" />
      </div>
    </div>
  );
}

export function ChessCard() {
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chess");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ChessSummary;
        if (cancelled) return;
        setState(data.ok ? { status: "ready", data } : { status: "error" });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <NowCard title={TITLE} footer={<Footer />}>
        <Skeleton />
      </NowCard>
    );
  }

  if (state.status === "error") {
    return (
      <NowCard title={TITLE} footer={<Footer />}>
        <div className={"mt-4 flex items-center " + BODY_MIN_H}>
          <p className="text-sm text-muted">Chess stats unavailable.</p>
        </div>
      </NowCard>
    );
  }

  const s = state.data;
  const pending = s.history.length === 0;

  return (
    <NowCard title={TITLE} footer={<Footer />}>
      <div className={"mt-4 flex flex-col gap-6 sm:flex-row " + BODY_MIN_H}>
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
          {s.lastGame ? (
            <ChessBoardSvg fen={s.lastGame.fen} myColor={s.lastGame.myColor} outcome={s.lastGame.outcome} className="h-full w-full" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-3xl font-semibold text-neutral-100">{s.rating ?? "--"}</span>
            <span className="text-xs uppercase tracking-widest text-muted">rapid</span>
            {s.peak !== null ? <span className="text-xs text-neutral-500">peak {s.peak}</span> : null}
            {!pending ? (
              <span className="text-xs text-neutral-500">
                {s.record.win}-{s.record.loss}-{s.record.draw} since {monthLabel(chess.trackSince)}
              </span>
            ) : null}
          </div>

          {pending ? (
            <p className="mt-4 text-sm text-muted">First rated game pending.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Delta label={s.d30Ref?.fallback ? `Since ${dayLabel(s.d30Ref.t)}` : "30 days"} value={s.deltas.d30} />
                <Delta label={`Since ${monthLabel(chess.trackSince)}`} value={s.deltas.sinceTrack} />
                <Delta
                  label={s.low ? `From low (${s.low.rating}, ${dayLabel(s.low.t)})` : "From low"}
                  value={s.deltas.fromLow}
                />
              </div>

              {s.rating !== null ? (
                <div className="mt-3">
                  <RatingSparkline history={s.history} goal={s.goal} rating={s.rating} startRating={s.startRating} />
                </div>
              ) : null}
            </>
          )}

          {s.lastGame ? (
            <p className="mt-3 min-w-0 text-sm text-body">
              <a
                href={s.lastGame.url}
                target="_blank"
                rel="noreferrer"
                className="flex max-w-full items-center gap-2 text-accent/90 hover:text-accent"
              >
                <span className="min-w-0 truncate">{lastGameLine(s.lastGame)}</span>
                <ExternalLinkIcon className="h-4 w-4 shrink-0" />
              </a>
            </p>
          ) : null}

          {s.bestWin ? (
            <p className="mt-1 text-sm text-muted">
              Best win:{" "}
              <a href={s.bestWin.url} target="_blank" rel="noreferrer" className="text-body hover:text-accent-text">
                beat a {s.bestWin.oppRating}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </NowCard>
  );
}

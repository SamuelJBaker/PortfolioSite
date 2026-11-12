"use client";

import * as React from "react";
import { chess, chessProfileUrl } from "../../content/chess";
import { dayLabel, formatDelta, monthLabel, relativeTime } from "../../lib/chess/format";
import type { ChessGameView, ChessSummary } from "../../lib/chess/types";
import { ExternalLinkIcon } from "../icons";
import { Board } from "../chess/Board";
import { BreakdownPanel } from "../chess/BreakdownPanel";
import { FormStrip } from "../chess/FormStrip";
import { SegmentedToggle } from "../chess/GameToggle";
import { OpeningsPanel } from "../chess/OpeningsPanel";
import { PieceDefs } from "../chess/Pieces";
import { RatingChart } from "../chess/RatingChart";
import { Tabs, type TabDef } from "../chess/Tabs";
import { NowCard } from "./NowCard";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: ChessSummary };
type TabId = "overview" | "openings" | "breakdown";
type Shown = "last" | "best";

const TITLE = "What I am playing";
// Every state shares this body height so loading, error and ready do not shift
// the page: 28.5rem is the ready body at md and up (board column plus form strip).
const BODY_MIN_H = "md:min-h-[28.5rem]";
const TABS: TabDef<TabId>[] = [
  { id: "overview", label: "Overview" },
  { id: "openings", label: "Openings" },
  { id: "breakdown", label: "Breakdown" },
];
const ID = "chess";

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
    <div className={"mt-4 flex flex-col gap-6 md:flex-row " + BODY_MIN_H} aria-busy="true" aria-label="Loading chess stats">
      <div className="w-full shrink-0 md:w-56">
        <div className="aspect-square w-full rounded-xl border border-line bg-neutral-950/40" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-8 w-28 rounded bg-line" />
        <div className="h-3 w-40 rounded bg-line/70" />
        <div className="h-28 w-full rounded bg-line/40" />
        <div className="h-3 w-56 rounded bg-line/70" />
      </div>
    </div>
  );
}

/** Board column: which game, the replay board, and the form strip. Constant across tabs. */
function BoardColumn({ s }: { s: ChessSummary }) {
  const [shown, setShown] = React.useState<Shown>("last");
  const game: ChessGameView | null = shown === "best" && s.bestWin ? s.bestWin : s.lastGame;
  if (!game) {
    return (
      <div className="w-full shrink-0 md:w-56">
        <div className="aspect-square w-full rounded-xl border border-line bg-neutral-950/40" />
      </div>
    );
  }
  const replay = game.replay;
  return (
    <div className="w-full shrink-0 md:w-56">
      {s.bestWin && s.bestWin.url !== s.lastGame?.url ? (
        <div className="mb-2">
          <SegmentedToggle
            label="Game shown on the board"
            value={shown}
            onChange={setShown}
            options={[
              { value: "last", label: "Last game" },
              { value: "best", label: "Best win" },
            ]}
          />
        </div>
      ) : null}
      <Board
        fens={replay ? replay.fens : [game.fen]}
        sans={replay ? replay.sans : []}
        lastMoves={replay ? replay.lastMoves : []}
        myColor={game.myColor}
        outcome={game.outcome}
      />
      <FormStrip form={s.form} />
    </div>
  );
}

function GameLink({ game, prefix }: { game: ChessGameView; prefix?: string }) {
  return (
    <a href={game.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-accent/90 hover:text-accent">
      <span>
        {prefix}
        {game.outcome} vs {game.oppRating}, {relativeTime(game.endTime)}
      </span>
      <ExternalLinkIcon className="h-4 w-4 shrink-0" />
    </a>
  );
}

function Overview({ s }: { s: ChessSummary }) {
  const pending = s.history.length === 0;
  return (
    <div>
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
            <Delta label={s.low ? `From low (${s.low.rating}, ${dayLabel(s.low.t)})` : "From low"} value={s.deltas.fromLow} />
          </div>
          {s.rating !== null && s.series.length > 0 ? (
            <div className="mt-3">
              <RatingChart series={s.series} goal={s.goal} rating={s.rating} startRating={s.startRating} />
            </div>
          ) : null}
        </>
      )}

      {s.lastGame ? (
        <div className="mt-3 text-sm text-body">
          <p>
            <span className="text-muted">Last game: </span>
            <GameLink game={s.lastGame} />
          </p>
          <p className="mt-1">
            <span className="text-muted">Opening: </span>
            {s.lastGame.openingUrl ? (
              <a href={s.lastGame.openingUrl} target="_blank" rel="noreferrer" className="text-body hover:text-accent-text">
                {s.lastGame.opening ?? "unknown"}
              </a>
            ) : (
              <span>{s.lastGame.opening ?? "unknown"}</span>
            )}
          </p>
        </div>
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
  );
}

export function ChessCard() {
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [tab, setTab] = React.useState<TabId>("overview");

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
  const panels: { id: TabId; node: React.ReactNode }[] = [
    { id: "overview", node: <Overview s={s} /> },
    { id: "openings", node: <OpeningsPanel openings={s.openings} /> },
    {
      id: "breakdown",
      node: (
        <BreakdownPanel
          colorSplit={s.colorSplit}
          endings={s.endings}
          expectation={s.expectation}
          streak={s.streak}
          activity={s.activity}
        />
      ),
    },
  ];

  return (
    <NowCard title={TITLE} footer={<Footer />} aside={<Tabs tabs={TABS} value={tab} onChange={setTab} idPrefix={ID} label="Chess card sections" />}>
      <PieceDefs />
      <div className={"mt-4 flex flex-col gap-6 md:flex-row " + BODY_MIN_H}>
        <BoardColumn s={s} />
        {/* All three panels share one grid cell: the column keeps the tallest panel's height, so switching never shifts the page. */}
        <div className="grid min-w-0 flex-1">
          {panels.map((p) => {
            const active = p.id === tab;
            return (
              <div
                key={p.id}
                id={`${ID}-panel-${p.id}`}
                role="tabpanel"
                aria-labelledby={`${ID}-tab-${p.id}`}
                aria-hidden={!active}
                className={"col-start-1 row-start-1 min-w-0 " + (active ? "" : "invisible")}
              >
                {p.node}
              </div>
            );
          })}
        </div>
      </div>
    </NowCard>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pulse as PulseIcon } from "@phosphor-icons/react";
import {
  bettorNetPL,
  bettorWinRate,
  fetchPulseData,
  type PulseData,
} from "@/lib/pulse";
import { AGENTS, fmtMon, shortAddr } from "@/lib/chain";
import { AgentMark } from "@/components/home/AgentMark";

type LoadState = "loading" | "ready" | "empty";

function StatusPill({ data }: { data: PulseData | null }) {
  if (!data) {
    return (
      <span className="tnum inline-flex items-center gap-2 rounded-full border hairline px-3 py-1 text-[11px] text-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-ash/60" />
        INDEXER SYNCING
      </span>
    );
  }
  if (data.mock) {
    return (
      <span className="tnum inline-flex items-center gap-2 rounded-full border border-amber-400/30 px-3 py-1 text-[11px] text-amber-300/90">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
        PREVIEW DATA
      </span>
    );
  }
  return (
    <span className="tnum inline-flex items-center gap-2 rounded-full border hairline px-3 py-1 text-[11px] text-acid">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-acid" />
      INDEXER LIVE
    </span>
  );
}

function AgentStrip({ data }: { data: PulseData }) {
  return (
    <section aria-label="Agent standings" className="mt-8">
      <p className="tnum text-[10px] tracking-[0.18em] text-faint">
        AGENT PERFORMANCE · ALL TIME
      </p>
      <div className="mt-3 grid grid-cols-1 divide-y hairline border-y hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {data.agents.map((a) => {
          const meta = AGENTS[a.id];
          // prefer the client-side recount; the indexer aggregate undercounts
          const won = data.roundsWonOverride?.[a.id] ?? a.roundsWon;
          return (
            <div key={a.id} className="flex items-center gap-4 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
              <AgentMark id={a.id} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-semibold tracking-tight">
                  {meta?.name ?? a.name}
                </p>
                <p className="tnum mt-0.5 text-[11px] text-faint">
                  {fmtMon(a.totalVolume)} MON VOL · {a.totalTrades} TRADES
                </p>
              </div>
              <div className="text-right">
                <p className="tnum text-2xl font-semibold text-acid">
                  {won}
                </p>
                <p className="tnum text-[10px] tracking-[0.14em] text-faint">
                  ROUNDS WON
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Leaderboard({ data }: { data: PulseData }) {
  return (
    <section aria-label="Bettor leaderboard">
      <p className="tnum text-[10px] tracking-[0.18em] text-faint">
        TOP BETTORS · BY VOLUME WAGERED
      </p>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="tnum grid grid-cols-[2.5rem_1.4fr_1fr_0.9fr_1fr] gap-4 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
            <span>RANK</span>
            <span>BETTOR</span>
            <span className="text-right">WAGERED</span>
            <span className="text-right">WIN RATE</span>
            <span className="text-right">NET P/L</span>
          </div>
          {data.bettors.map((b, i) => {
            const pnl = bettorNetPL(b);
            const pnlUp = pnl >= 0n;
            const rate = bettorWinRate(b);
            return (
              <div
                key={b.address}
                className="grid grid-cols-[2.5rem_1.4fr_1fr_0.9fr_1fr] items-center gap-4 border-b hairline py-3.5 last:border-b-0"
              >
                <span
                  className={`tnum text-[15px] ${i === 0 ? "text-acid" : "text-faint"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="tnum truncate text-[13px] text-bone"
                  title={b.address}
                >
                  {shortAddr(b.address)}
                </span>
                <span className="tnum text-right text-[13px] text-ash">
                  {fmtMon(b.totalWagered)}
                </span>
                <span className="tnum text-right text-[13px] text-ash">
                  {rate === null ? "—" : `${(rate * 100).toFixed(0)}%`}
                </span>
                <span
                  className={`tnum text-right text-[14px] font-medium ${pnlUp ? "text-acid" : "text-blood"}`}
                >
                  {pnlUp ? "+" : ""}
                  {fmtMon(pnl)}
                </span>
              </div>
            );
          })}
          {data.bettors.length === 0 && (
            <p className="py-10 text-center text-[13px] text-faint">
              No bettors indexed yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function RecentRounds({ data }: { data: PulseData }) {
  return (
    <section aria-label="Recent rounds">
      <p className="tnum text-[10px] tracking-[0.18em] text-faint">
        RECENT ROUNDS
      </p>
      <div className="mt-3">
        <div className="tnum grid grid-cols-[3rem_1fr_auto] gap-3 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
          <span>ROUND</span>
          <span>STATUS</span>
          <span className="text-right">VOLUME</span>
        </div>
        {data.rounds.map((r) => {
          const meta =
            r.winnerAgentId !== null ? AGENTS[Number(r.winnerAgentId)] : undefined;
          // A round with zero bets settled into refunds by definition —
          // don't dress it up as "REFUND"; it simply had no players.
          const noBets = r.status === "REFUND" && r.betCount <= 0;
          const label = noBets ? "NO BETS" : r.status;
          return (
            <div
              key={r.id}
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b hairline py-3 last:border-b-0"
            >
              <span className="tnum text-[13px] text-faint">#{r.id}</span>
              <span className="min-w-0">
                <span
                  className={`tnum text-[11px] font-semibold tracking-[0.1em] ${
                    noBets
                      ? "text-faint"
                      : r.status === "SETTLED"
                        ? "text-acid"
                        : "text-ash"
                  }`}
                >
                  {label}
                </span>
                {meta && !noBets && (
                  <span className="block truncate text-[12px] text-faint">
                    {meta.name}
                  </span>
                )}
              </span>
              <span className="tnum text-right text-[13px] text-ash">
                {fmtMon(r.totalVolume)}
              </span>
            </div>
          );
        })}
        {data.rounds.length === 0 && (
          <p className="py-10 text-center text-[13px] text-faint">
            No rounds indexed yet.
          </p>
        )}
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-hidden className="mt-8">
      <div className="skeleton h-4 w-48 rounded-md bg-white/[0.06]" />
      <div className="mt-4 grid grid-cols-1 gap-px sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-4">
            <div className="skeleton h-5 w-2/3 rounded-md bg-white/[0.06]" />
            <div className="skeleton mt-2 h-3 w-1/2 rounded-md bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-12 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function PulsePage() {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<PulseData | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPulseData().then((d) => {
      if (!alive) return;
      setData(d);
      setState(d ? "ready" : "empty");
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="pt-8 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <PulseIcon size={26} className="text-acid" />
        <h1 className="font-display font-wide text-3xl font-extrabold tracking-tight md:text-4xl">
          Pulse
        </h1>
        <span className="mt-1">
          <StatusPill data={data} />
        </span>
      </div>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ash">
        On-chain analytics for the arena — bettors, agents, and rounds, read
        from the Envio HyperIndex indexer instead of polled from RPC.{" "}
        <Link
          href="/arena"
          className="text-bone underline decoration-white/20 underline-offset-4 transition-colors hover:text-acid"
        >
          Back to the live arena
        </Link>
        .
      </p>

      {state === "loading" && <LoadingSkeleton />}

      {state === "empty" && (
        <div className="mt-8 rounded-2xl border hairline bg-panel p-6 sm:p-8">
          <p className="font-display text-[16px] font-semibold tracking-tight">
            Analytics indexer syncing
          </p>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-ash">
            Pulse reads from the Envio HyperIndex indexer, which is still
            catching up with on-chain history. Check back soon — the arena
            itself is unaffected.
          </p>
        </div>
      )}

      {state === "ready" && data && (
        <>
          <AgentStrip data={data} />
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.65fr_1fr]">
            <Leaderboard data={data} />
            <RecentRounds data={data} />
          </div>
        </>
      )}
    </div>
  );
}

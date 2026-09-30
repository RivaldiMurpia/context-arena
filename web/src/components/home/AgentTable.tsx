"use client";

import Link from "next/link";
import type { AgentState, FeedItem } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";
import { AgentMark } from "./AgentMark";

interface Props {
  agents: AgentState[];
  feed: FeedItem[];
  loading: boolean;
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_0.7fr_0.9fr] items-center gap-4 border-t hairline py-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skeleton h-4 rounded-md bg-white/[0.06]"
        />
      ))}
    </div>
  );
}

export function AgentTable({ agents, feed, loading }: Props) {
  const tradesOf = (id: number) =>
    feed.filter((f) => f.kind === "trade" && f.agentId === id).length;
  const sorted = [...agents].sort((a, b) =>
    a.portfolio > b.portfolio ? -1 : 1
  );

  return (
    <section aria-label="Agents">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          The fighters
        </h2>
        <span className="tnum text-[11px] text-faint">
          {sorted.length} AGENTS · LIVE
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="tnum grid grid-cols-[1.5fr_1fr_1fr_0.7fr_0.9fr] gap-4 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
            <span>AGENT</span>
            <span className="text-right">PORTFOLIO</span>
            <span className="text-right">PNL</span>
            <span className="text-right">TRADES</span>
            <span className="text-right">BETS</span>
          </div>

          {loading && sorted.length === 0 && (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          )}

          {!loading &&
            sorted.map((a) => {
              const meta = AGENTS[a.id];
              const pnlMon = Number(a.pnl) / 1e18; // capital is exactly 100 MON, so PnL% == PnL in MON
              const up = pnlMon >= 0;
              const abs = a.pnl < 0n ? -a.pnl : a.pnl;
              return (
                <Link
                  key={a.id}
                  href="/arena"
                  className="grid grid-cols-[1.5fr_1fr_1fr_0.7fr_0.9fr] items-center gap-4 border-b hairline py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <AgentMark id={a.id} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-bone">
                        {meta.name}
                      </span>
                      <span className="block truncate text-[12px] text-faint">
                        {meta.tagline}
                      </span>
                    </span>
                  </span>
                  <span className="tnum text-right text-[14px] text-bone">
                    {fmtMon(a.portfolio, 2)}
                  </span>
                  <span className="text-right">
                    <span
                      className={`tnum block text-[14px] font-medium ${up ? "text-acid" : "text-blood"}`}
                    >
                      {up ? "+" : "-"}
                      {Math.abs(pnlMon).toFixed(2)}%
                    </span>
                    <span className="tnum block text-[11px] text-faint">
                      {up ? "+" : "-"}
                      {fmtMon(abs, 2)}
                    </span>
                  </span>
                  <span className="tnum text-right text-[14px] text-ash">
                    {tradesOf(a.id)}
                  </span>
                  <span className="tnum text-right text-[14px] text-ash">
                    {fmtMon(a.betsOn, 2)}
                  </span>
                </Link>
              );
            })}

          {!loading && sorted.length === 0 && (
            <p className="py-10 text-center text-[13px] text-faint">
              No agent data yet — the game master is spinning up the next round.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

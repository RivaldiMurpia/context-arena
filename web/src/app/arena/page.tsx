"use client";

import { useArena } from "@/hooks/useArena";
import type { FeedItem } from "@/lib/arena";
import { Header } from "@/components/Header";
import { LiveSection } from "@/components/LiveSection";
import { RoundPanel } from "@/components/RoundPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { BettingPanel } from "@/components/BettingPanel";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RoundHistory } from "@/components/RoundHistory";
import { HowItWorks } from "@/components/HowItWorks";
import { ARENA_ADDRESS, EXPLORER_ADDR } from "@/lib/chain";
import { ArrowSquareOut } from "@phosphor-icons/react";

function Footer() {
  return (
    <footer className="mt-16 border-t hairline">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 text-[12px] leading-relaxed text-faint md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-[70ch]">
          Context Arena is a hackathon demo on Monad testnet — no real money.
          CTX prices come from the game master, agent funds are virtual, and
          only spectator bets move MON.
        </p>
        <div className="tnum flex shrink-0 items-center gap-4">
          <a
            href={EXPLORER_ADDR(ARENA_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            CONTRACT <ArrowSquareOut size={12} />
          </a>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            FAUCET <ArrowSquareOut size={12} />
          </a>
          <a
            href="https://github.com/RivaldiMurpia/context-arena"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            GITHUB <ArrowSquareOut size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function ArenaPage() {
  const a = useArena();
  const hasData = a.roundId !== null;

  return (
    <div className="min-h-dvh bg-void text-bone">
      <Header roundId={a.roundId} live={a.hasActive && a.status === "live"} />

      <main className="mx-auto max-w-[1400px] px-4 md:px-6">
        {a.status === "loading" && !hasData && (
          <div className="flex items-center gap-3 py-24">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" />
            <span className="tnum text-[13px] text-ash">
              connecting to Monad testnet…
            </span>
          </div>
        )}

        {a.status === "error" && (
          <div className="mt-6 border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.06)] px-4 py-3 text-[13px] text-blood">
            Can&apos;t reach the Monad testnet RPC ({a.error})
            {hasData ? " — showing last known data, retrying…" : " — retrying…"}
          </div>
        )}

        {hasData && (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <LiveSection
                  price={a.price}
                  priceHistory={a.priceHistory}
                  round={a.round}
                  roundId={a.roundId}
                  roundTrades={a.roundTrades}
                />
              </div>
              <div className="lg:col-span-4">
                <RoundPanel
                  round={a.round}
                  roundId={a.roundId}
                  hasActive={a.hasActive}
                  now={a.now}
                />
              </div>

              <div className="lg:col-span-8">
                <Leaderboard
                  agents={a.agents}
                  price={a.price}
                  trades={a.feed.filter(
                    (f): f is Extract<FeedItem, { kind: "trade" }> =>
                      f.kind === "trade"
                  )}
                  winnerId={
                    a.round?.settled ? a.round.winnerAgentId : null
                  }
                />
              </div>
              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-6">
                  <BettingPanel
                    round={a.round}
                    roundId={a.roundId}
                    agents={a.agents}
                    hasActive={a.hasActive}
                    now={a.now}
                  />
                </div>
              </div>

              <div className="lg:col-span-8">
                <ActivityFeed feed={a.feed} />
              </div>
              <div className="lg:col-span-4">
                <RoundHistory roundCount={a.roundCount} />
              </div>
            </div>

            <div className="mt-14">
              <HowItWorks />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

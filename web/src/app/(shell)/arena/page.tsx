"use client";

import { useArena, fmtCountdown, phaseOf } from "@/hooks/useArena";
import type { FeedItem, RoundInfo } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";
import { PhasePill } from "@/components/PhasePill";
import { LiveSection } from "@/components/LiveSection";
import { Leaderboard } from "@/components/Leaderboard";
import { BettingPanel } from "@/components/BettingPanel";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RoundHistory } from "@/components/RoundHistory";
import { HowItWorks } from "@/components/HowItWorks";
import { WinFx } from "@/components/WinFx";

/** First-paint skeleton matching the arena grid shape (no layout shift on load). */
function ArenaSkeleton() {
  return (
    <div aria-hidden className="pt-6">
      <div className="skeleton h-[92px] rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div className="skeleton h-[440px] rounded-2xl bg-white/[0.04]" />
          <div className="skeleton h-[240px] rounded-2xl bg-white/[0.04]" />
        </div>
        <div className="skeleton h-[420px] rounded-2xl bg-white/[0.04] lg:col-span-4" />
      </div>
      <p className="tnum mt-8 flex items-center gap-3 text-[13px] text-ash">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" />
        connecting to Monad testnet…
      </p>
    </div>
  );
}

/**
 * Broadcast scoreboard: one strip that owns round identity, phase, the single
 * countdown and the pool. Everything below the fold reads against it — no
 * other element on the page repeats these numbers.
 */
function Scoreboard({
  round,
  roundId,
  hasActive,
  now,
  live,
}: {
  round: RoundInfo | null;
  roundId: bigint | null;
  hasActive: boolean;
  now: number;
  live: boolean;
}) {
  const phase = phaseOf(round, hasActive, now);
  const winner =
    round?.settled ? (AGENTS[Number(round.winnerAgentId)] ?? null) : null;

  return (
    <section
      aria-label="Round scoreboard"
      className="relative mt-6 overflow-hidden rounded-2xl border hairline bg-obsidian px-5 py-4 md:px-7 md:py-5"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 140% at 85% 0%, rgba(163,230,53,0.07), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="tnum flex items-center gap-2 text-[10px] tracking-[0.2em] text-faint">
            {live && (
              <span
                className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-acid"
                aria-hidden
              />
            )}
            ROUND
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-display font-wide text-3xl font-extrabold tracking-tight text-bone md:text-4xl">
              #{roundId !== null ? roundId.toString() : "—"}
            </span>
            <PhasePill round={round} hasActive={hasActive} now={now} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          {/* Single countdown source for the page; hidden while settling. */}
          {round && !round.settled && phase !== "settling" && (
            <div>
              <p className="tnum text-[10px] tracking-[0.2em] text-faint">
                {phase === "betting" ? "BETTING CLOSES" : "ROUND ENDS"}
              </p>
              <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-bone md:text-4xl">
                {fmtCountdown(
                  Number(
                    phase === "betting"
                      ? round.bettingCloseTime
                      : round.endTime
                  ),
                  now
                )}
              </p>
            </div>
          )}

          {round?.settled && winner && (
            <div>
              <p className="tnum text-[10px] tracking-[0.2em] text-faint">
                WINNER @ {fmtMon(round.endPrice)}
              </p>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight text-bone md:text-3xl">
                {winner.name}
              </p>
            </div>
          )}

          {round && (
            <div>
              <p className="tnum text-[10px] tracking-[0.2em] text-faint">
                {round.settled ? "POOL PAID" : "POOL"}
              </p>
              <p className="tnum mt-1 text-2xl font-semibold text-acid md:text-3xl">
                {fmtMon(round.betPool)}{" "}
                <span className="text-[13px] font-normal text-ash">MON</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {!round && (
        <p className="relative mt-2 text-sm text-ash">
          No rounds yet. The game master opens a new round every few minutes.
        </p>
      )}
    </section>
  );
}

export default function ArenaPage() {
  const a = useArena();
  const hasData = a.roundId !== null;
  const trades = a.feed.filter(
    (f): f is Extract<FeedItem, { kind: "trade" }> => f.kind === "trade"
  );

  return (
    <>
      {a.status === "loading" && !hasData && <ArenaSkeleton />}

      {a.status === "error" && (
        <div className="mt-6 border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.06)] px-4 py-3 text-[13px] text-blood">
          Can&apos;t reach the Monad testnet RPC ({a.error})
          {hasData ? " — showing last known data, retrying…" : " — retrying…"}
        </div>
      )}

      {hasData && (
        <>
          <WinFx round={a.round} roundId={a.roundId} />

          <Scoreboard
            round={a.round}
            roundId={a.roundId}
            hasActive={a.hasActive}
            now={a.now}
            live={a.hasActive && a.status === "live"}
          />

          <div className="grid grid-cols-1 gap-x-6 gap-y-10 pt-6 lg:grid-cols-12">
            <div className="space-y-10 lg:col-span-8">
              <LiveSection
                price={a.price}
                priceHistory={a.priceHistory}
                round={a.round}
                roundTrades={a.roundTrades}
                trades={trades}
              />
              <Leaderboard
                agents={a.agents}
                price={a.price}
                trades={trades}
                winnerId={
                  a.round?.settled ? a.round.winnerAgentId : null
                }
              />
              <ActivityFeed feed={a.feed} />
            </div>
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-24">
                <BettingPanel
                  round={a.round}
                  roundId={a.roundId}
                  agents={a.agents}
                  hasActive={a.hasActive}
                  now={a.now}
                />
              </div>
              <div className="mt-10">
                <RoundHistory roundCount={a.roundCount} />
              </div>
            </div>
          </div>

          <div className="mt-12">
            <HowItWorks />
          </div>
        </>
      )}
    </>
  );
}

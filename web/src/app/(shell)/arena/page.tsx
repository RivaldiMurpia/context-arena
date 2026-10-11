"use client";

import { useArena, fmtCountdown, phaseOf } from "@/hooks/useArena";
import type { FeedItem, RoundInfo } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";
import { PhasePill } from "@/components/PhasePill";
import { LiveSection } from "@/components/LiveSection";
import { RoundPanel } from "@/components/RoundPanel";
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
      <div className="flex items-center gap-3">
        <div className="skeleton h-3 w-3 rounded-full bg-white/[0.08]" />
        <div className="skeleton h-6 w-40 rounded-lg bg-white/[0.06]" />
        <div className="skeleton ml-auto h-6 w-48 rounded-lg bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 pt-5 lg:grid-cols-12">
        <div className="skeleton h-[360px] rounded-2xl bg-white/[0.04] lg:col-span-8" />
        <div className="skeleton h-[360px] rounded-2xl bg-white/[0.04] lg:col-span-4" />
        <div className="skeleton h-[220px] rounded-2xl bg-white/[0.04] lg:col-span-8" />
        <div className="skeleton h-[220px] rounded-2xl bg-white/[0.04] lg:col-span-4" />
      </div>
      <p className="tnum mt-6 flex items-center gap-3 text-[13px] text-ash">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" />
        connecting to Monad testnet…
      </p>
    </div>
  );
}

/**
 * Compact trading-terminal header: round identity + phase on the left,
 * the numbers that matter for a bettor on the right. The shell provides
 * the sidebar, top bar and footer.
 */
function ArenaPageHeader({
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
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
      <div className="flex items-center gap-3">
        <span
          className={`live-dot inline-block h-2 w-2 rounded-full ${live ? "bg-acid" : "bg-faint"}`}
          aria-hidden
        />
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Arena{" "}
          <span className="tnum font-normal text-ash">
            #{roundId !== null ? roundId.toString() : "—"}
          </span>
        </h1>
        <PhasePill round={round} hasActive={hasActive} now={now} />
      </div>

      {round && !round.settled && (
        <div className="tnum ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
          {/* Single countdown source for the page. Label follows the phase:
              BETTING CLOSES while betting is open, ROUND ENDS afterwards;
              hidden while settling (the phase pill says SETTLING…). */}
          {phase !== "settling" && (
            <span>
              <span className="text-faint">
                {phase === "betting" ? "BETTING CLOSES" : "ROUND ENDS"}
                &nbsp;
              </span>
              <span className="text-bone">
                {fmtCountdown(
                  Number(
                    phase === "betting"
                      ? round.bettingCloseTime
                      : round.endTime
                  ),
                  now
                )}
              </span>
            </span>
          )}
          <span>
            <span className="text-faint">POOL&nbsp;</span>
            <span className="text-acid">{fmtMon(round.betPool)} MON</span>
          </span>
        </div>
      )}
      {round?.settled && (
        <div className="tnum ml-auto text-[12px]">
          <span className="text-faint">POOL PAID&nbsp;</span>
          <span className="text-bone">{fmtMon(round.betPool)} MON</span>
        </div>
      )}
    </div>
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

          <ArenaPageHeader
            round={a.round}
            roundId={a.roundId}
            hasActive={a.hasActive}
            now={a.now}
            live={a.hasActive && a.status === "live"}
          />

          <div className="grid grid-cols-1 gap-x-6 gap-y-8 pt-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <LiveSection
                price={a.price}
                priceHistory={a.priceHistory}
                round={a.round}
                roundTrades={a.roundTrades}
                trades={trades}
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
                trades={trades}
                winnerId={
                  a.round?.settled ? a.round.winnerAgentId : null
                }
              />
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
            </div>

            <div className="lg:col-span-8">
              <ActivityFeed feed={a.feed} />
            </div>
            <div className="lg:col-span-4">
              <RoundHistory roundCount={a.roundCount} />
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

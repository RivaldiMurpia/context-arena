"use client";

import { useArena } from "@/hooks/useArena";
import { useHallOfFame } from "@/hooks/useHallOfFame";
import { useShell } from "@/components/shell/ShellContext";
import { LiveTicker } from "@/components/home/LiveTicker";
import { PromoCarousel } from "@/components/home/PromoCarousel";
import { AgentTable } from "@/components/home/AgentTable";
import { HallOfFame } from "@/components/home/HallOfFame";
import { HowItWorksStrip } from "@/components/home/HowItWorksStrip";
import { AGENTS } from "@/lib/chain";

export default function HomePage() {
  const a = useArena();
  const fame = useHallOfFame(5);
  const { query } = useShell();

  const hasData = a.roundId !== null;
  const q = query.trim().toLowerCase();
  const agents = q
    ? a.agents.filter((s) =>
        AGENTS[s.id]?.name.toLowerCase().includes(q)
      )
    : a.agents;

  return (
    <div className="pb-16">
      <LiveTicker
        status={a.status}
        roundId={a.roundId}
        hasActive={a.hasActive}
        price={a.price}
        round={a.round}
        now={a.now}
      />

      {a.status === "loading" && !hasData && (
        <div className="flex items-center gap-3 py-24">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" />
          <span className="tnum text-[13px] text-ash">
            connecting to Monad testnet…
          </span>
        </div>
      )}

      {a.status === "error" && !hasData && (
        <div className="mt-6 border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.06)] px-4 py-3 text-[13px] text-blood">
          Can&apos;t reach the Monad testnet RPC — retrying…
        </div>
      )}

      {hasData && (
        <>
          <PromoCarousel
            status={a.status}
            roundId={a.roundId}
            hasActive={a.hasActive}
            price={a.price}
            priceHistory={a.priceHistory}
            round={a.round}
            now={a.now}
          />

          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-[2fr_1fr]">
            <AgentTable
              agents={agents}
              feed={a.feed}
              loading={a.status === "loading"}
            />
            <HallOfFame entries={fame.entries} loading={fame.loading} />
          </div>

          <HowItWorksStrip />
        </>
      )}
    </div>
  );
}

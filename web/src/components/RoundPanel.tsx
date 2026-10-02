"use client";

import { Trophy } from "@phosphor-icons/react";
import type { RoundInfo } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";
import { fmtCountdown, phaseOf } from "@/hooks/useArena";
import { PhasePill } from "./PhasePill";

export function RoundPanel({
  round,
  roundId,
  hasActive,
  now,
}: {
  round: RoundInfo | null;
  roundId: bigint | null;
  hasActive: boolean;
  now: number;
}) {
  const phase = phaseOf(round, hasActive, now);

  return (
    <aside className="flex flex-col rounded-2xl border hairline bg-panel p-5">
      <div className="flex items-center justify-between">
        <span className="tnum text-[11px] tracking-[0.18em] text-faint">ROUND</span>
        <PhasePill round={round} hasActive={hasActive} now={now} />
      </div>

      <div className="tnum mt-2 text-5xl font-semibold tracking-tight text-bone">
        {roundId !== null ? `#${roundId.toString()}` : "—"}
      </div>

      {round && !round.settled && (
        <div className="tnum mt-5 space-y-3 text-[13px]">
          <div className="flex items-baseline justify-between border-b hairline pb-3">
            <span className="text-[10px] tracking-[0.14em] text-faint">BETTING CLOSES</span>
            <span className="text-lg text-bone">
              {phase === "betting"
                ? fmtCountdown(Number(round.bettingCloseTime), now)
                : "closed"}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-b hairline pb-3">
            <span className="text-[10px] tracking-[0.14em] text-faint">ROUND ENDS</span>
            <span className="text-lg text-bone">
              {fmtCountdown(Number(round.endTime), now)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] tracking-[0.14em] text-faint">BET POOL</span>
            <span className="text-lg text-acid">{fmtMon(round.betPool)} MON</span>
          </div>
        </div>
      )}

      {round?.settled && (
        <div className="mt-5 border-t hairline pt-4">
          <div className="flex items-center gap-2 text-acid">
            <Trophy size={18} weight="fill" />
            <span className="font-display text-lg font-semibold text-bone">
              {AGENTS[Number(round.winnerAgentId)]?.name ?? "—"}
            </span>
          </div>
          <div className="tnum mt-2 space-y-1.5 text-[12px] text-ash">
            <div className="flex justify-between">
              <span>END PRICE</span>
              <span className="text-bone">{fmtMon(round.endPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span>POOL PAID</span>
              <span className="text-bone">{fmtMon(round.betPool)} MON</span>
            </div>
            {round.refundMode && (
              <div className="text-[11px] text-faint">
                Nobody backed the winner — all bets refundable.
              </div>
            )}
          </div>
        </div>
      )}

      {!round && (
        <p className="mt-4 text-sm leading-relaxed text-ash">
          No rounds yet. The game master opens a new round every few minutes.
        </p>
      )}

      <p className="mt-auto pt-5 text-[11px] leading-relaxed text-faint">
        Winner is the agent with the highest portfolio value at round end.
        Payouts are parimutuel — split pro-rata among winning bettors.
      </p>
    </aside>
  );
}

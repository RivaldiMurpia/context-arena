"use client";

import { fmtCountdown, phaseOf } from "@/hooks/useArena";
import type { RoundInfo } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";

interface Props {
  status: "loading" | "live" | "error";
  roundId: bigint | null;
  hasActive: boolean;
  price: bigint;
  round: RoundInfo | null;
  now: number;
}

/** Slim broadcast strip: live state, round, price, countdown, pool. */
export function LiveTicker({ status, roundId, hasActive, price, round, now }: Props) {
  const phase = phaseOf(round, hasActive, now);
  const target =
    phase === "betting"
      ? Number(round!.bettingCloseTime)
      : phase === "trading"
        ? Number(round!.endTime)
        : null;
  const phaseLabel =
    phase === "betting"
      ? "BETTING CLOSES"
      : phase === "trading"
        ? "TRADING ENDS"
        : phase === "settling"
          ? "SETTLING"
          : phase === "settled"
            ? "SETTLED"
            : "IDLE";

  return (
    <div className="tnum flex items-center gap-5 overflow-x-auto border-b hairline py-2.5 text-[11px] whitespace-nowrap text-ash sm:gap-7">
      <span className="flex items-center gap-2 text-bone">
        <span
          className={`live-dot inline-block h-1.5 w-1.5 rounded-full ${
            status === "live" && hasActive ? "bg-acid" : "bg-faint"
          }`}
        />
        {status === "live" && hasActive ? "LIVE" : phaseLabel}
      </span>
      <span>
        ROUND{" "}
        <span className="text-bone">
          {roundId !== null ? roundId.toString() : "—"}
        </span>
      </span>
      <span>
        CTX{" "}
        <span className="text-bone">
          {price > 0n ? `${fmtMon(price, 4)} MON` : "—"}
        </span>
      </span>
      <span>
        {phaseLabel}{" "}
        <span className="text-acid">
          {target !== null ? fmtCountdown(target, now) : "—"}
        </span>
      </span>
      <span className="ml-auto">
        POOL{" "}
        <span className="text-bone">
          {round ? `${fmtMon(round.betPool, 2)} MON` : "—"}
        </span>
      </span>
    </div>
  );
}

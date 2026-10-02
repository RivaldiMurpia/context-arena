"use client";

import type { RoundInfo } from "@/lib/arena";
import { phaseOf } from "@/hooks/useArena";

const PHASE_COPY: Record<string, { label: string; cls: string }> = {
  betting: { label: "BETTING OPEN", cls: "bg-acid text-void" },
  trading: { label: "TRADING", cls: "bg-elev text-bone" },
  settling: { label: "SETTLING…", cls: "bg-elev text-ash" },
  settled: { label: "SETTLED", cls: "bg-elev text-ash" },
  idle: { label: "IDLE", cls: "bg-elev text-faint" },
};

/** Shared round phase pill — used by the arena header and RoundPanel. */
export function PhasePill({
  round,
  hasActive,
  now,
}: {
  round: RoundInfo | null;
  hasActive: boolean;
  now: number;
}) {
  const phase = phaseOf(round, hasActive, now);
  const p = PHASE_COPY[phase];
  return (
    <span
      className={`tnum rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${p.cls}`}
    >
      {p.label}
    </span>
  );
}

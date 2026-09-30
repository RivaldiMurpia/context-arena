"use client";

import { useEffect, useState } from "react";
import { readBasics, readRound } from "@/lib/arena";

export interface FameEntry {
  roundId: bigint;
  winnerAgentId: number;
  endPrice: bigint;
  /** betPool / winningBets, null when nobody backed the winner (refundable). */
  payoutX: number | null;
  refundMode: boolean;
}

/**
 * Last N settled rounds, newest first. Scans backwards from the latest
 * round with cheap eth_calls (no event scan needed).
 */
export function useHallOfFame(count: number) {
  const [entries, setEntries] = useState<FameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const b = await readBasics();
        const out: FameEntry[] = [];
        let rid = b.roundCount - 1n;
        let scanned = 0;
        while (rid >= 0n && out.length < count && scanned < 30) {
          const r = await readRound(rid);
          if (r.settled) {
            out.push({
              roundId: r.id,
              winnerAgentId: Number(r.winnerAgentId),
              endPrice: r.endPrice,
              payoutX:
                r.winningBets > 0n
                  ? Number((r.betPool * 100n) / r.winningBets) / 100
                  : null,
              refundMode: r.refundMode,
            });
          }
          rid -= 1n;
          scanned += 1;
        }
        if (!dead) setEntries(out);
      } catch {
        /* keep previous entries; panel shows empty state */
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [count]);

  return { entries, loading };
}

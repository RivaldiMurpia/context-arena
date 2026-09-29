"use client";

import { useEffect, useState } from "react";
import { readRound, type RoundInfo } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";

export function RoundHistory({ roundCount }: { roundCount: bigint }) {
  const [rounds, setRounds] = useState<RoundInfo[]>([]);

  useEffect(() => {
    if (roundCount < 2n) return;
    let alive = true;
    const load = async () => {
      const ids: bigint[] = [];
      // skip the latest round (shown elsewhere), take up to 5 before it
      for (let i = roundCount - 2n; i >= 0n && ids.length < 5; i--) ids.push(i);
      try {
        const rs = await Promise.all(ids.map(readRound));
        if (alive) setRounds(rs);
      } catch {
        // RPC hiccup (e.g. rate limit) — throttled client retries; next tick reloads
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [roundCount]);

  if (rounds.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Past rounds
      </h2>
      <div className="mt-2 border-t hairline">
        {rounds.map((r) => (
          <div
            key={r.id.toString()}
            className="flex items-baseline justify-between gap-2 border-b hairline py-3 text-[13px] last:border-b-0"
          >
            <span className="tnum text-faint">#{r.id.toString()}</span>
            <span className="truncate font-medium text-bone">
              {r.settled
                ? (AGENTS[Number(r.winnerAgentId)]?.name ?? "—")
                : "unsettled"}
            </span>
            <span className="tnum ml-auto text-ash">
              {r.settled ? fmtMon(r.endPrice) : "—"}
            </span>
            <span className="tnum text-faint">{fmtMon(r.betPool)}</span>
          </div>
        ))}
      </div>
      <div className="tnum mt-2 flex justify-between text-[10px] tracking-[0.1em] text-faint">
        <span>WINNER</span>
        <span>END PRICE · POOL MON</span>
      </div>
    </section>
  );
}

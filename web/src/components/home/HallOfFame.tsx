"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { FameEntry } from "@/hooks/useHallOfFame";
import { AGENTS, fmtMon } from "@/lib/chain";
import { AgentMark } from "./AgentMark";

interface Props {
  entries: FameEntry[];
  loading: boolean;
}

function RowsSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="border-t hairline py-3.5 first:border-t-0">
          <div className="skeleton h-4 w-3/4 rounded-md bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export function HallOfFame({ entries, loading }: Props) {
  return (
    <section aria-label="Hall of fame">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          Hall of fame
        </h2>
        <Link
          href="/history"
          className="tnum inline-flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-ash transition-colors hover:text-acid"
        >
          EXPLORE ALL
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="mt-3">
        {loading && entries.length === 0 && <RowsSkeleton />}

        {!loading &&
          entries.map((e) => (
            <div
              key={e.roundId.toString()}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t hairline py-3.5 first:border-t-0"
            >
              <span className="tnum w-10 text-[11px] text-faint">
                R{e.roundId.toString()}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <AgentMark id={e.winnerAgentId} size="sm" />
                <span className="truncate text-[13px] font-medium text-bone">
                  {AGENTS[e.winnerAgentId]?.name ?? "—"}
                </span>
              </span>
              <span className="text-right">
                {e.payoutX !== null ? (
                  <span className="tnum block text-[14px] font-medium text-acid">
                    {e.payoutX.toFixed(2)}×
                  </span>
                ) : (
                  <span className="tnum block text-[12px] text-faint">
                    REFUND
                  </span>
                )}
                <span className="tnum block text-[11px] text-faint">
                  {fmtMon(e.endPrice, 2)}
                </span>
              </span>
            </div>
          ))}

        {!loading && entries.length === 0 && (
          <p className="border-t hairline py-10 text-center text-[13px] text-faint">
            No settled rounds yet — the first winner lands here.
          </p>
        )}
      </div>
    </section>
  );
}

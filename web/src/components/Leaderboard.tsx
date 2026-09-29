"use client";

import type { AgentState, FeedItem } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";

type TradeItem = Extract<FeedItem, { kind: "trade" }>;

function lastTrade(trades: TradeItem[], agentId: number): TradeItem | undefined {
  return trades.find((f) => f.agentId === agentId);
}

function AgentRow({
  a,
  rank,
  price,
  trade,
  isWinner,
}: {
  a: AgentState;
  rank: number;
  price: bigint;
  trade: TradeItem | undefined;
  isWinner: boolean;
}) {
  const meta = AGENTS[a.id];
  const pnlUp = a.pnl >= 0n;
  const holdingsVal = (a.holdings * price) / 10n ** 18n;
  const total = a.portfolio > 0n ? a.portfolio : 1n;
  const ctxPct = Number((holdingsVal * 100n) / total);

  return (
    <div
      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b hairline py-4 last:border-b-0 md:grid-cols-[2.5rem_1.4fr_1fr_auto] md:gap-4 ${
        isWinner ? "bg-[rgba(163,230,53,0.04)]" : ""
      }`}
    >
      <span className={`tnum text-xl ${rank === 1 ? "text-acid" : "text-faint"}`}>
        {String(rank).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-[16px] font-semibold tracking-tight">
            {meta.name}
          </span>
          {isWinner && (
            <span className="tnum rounded-full bg-acid px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-void">
              WINNER
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-faint">{meta.tagline}</div>
        {trade && (
          <div className="tnum mt-1 truncate text-[11px] text-ash">
            <span className={trade.isBuy ? "text-acid" : "text-blood"}>
              {trade.isBuy ? "BOUGHT" : "SOLD"}
            </span>{" "}
            {trade.isBuy
              ? `${fmtMon(trade.amountIn)} MON`
              : `${fmtMon(trade.amountOut)} CTX`}{" "}
            @ {fmtMon(trade.price)}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <div className="text-[10px] tracking-[0.14em] text-faint">POSITION</div>
        <div className="mt-1.5 h-[3px] w-36 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <div className="h-full bg-acid" style={{ width: `${ctxPct}%` }} />
        </div>
        <div className="tnum mt-1 text-[10px] text-faint">
          {ctxPct}% CTX · {100 - ctxPct}% MON
        </div>
      </div>

      <div className="text-right">
        <div className="tnum text-xl font-semibold text-bone">
          {fmtMon(a.portfolio)}
          <span className="text-[12px] font-normal text-faint"> MON</span>
        </div>
        <div
          className={`tnum mt-0.5 text-[12px] ${pnlUp ? "text-acid" : "text-blood"}`}
        >
          {pnlUp ? "+" : ""}
          {fmtMon(a.pnl)}
        </div>
      </div>
    </div>
  );
}

export function Leaderboard({
  agents,
  price,
  trades,
  winnerId,
}: {
  agents: AgentState[];
  price: bigint;
  trades: Extract<FeedItem, { kind: "trade" }>[];
  winnerId: bigint | null;
}) {
  const ranked = [...agents].sort((a, b) =>
    a.portfolio > b.portfolio ? -1 : a.portfolio < b.portfolio ? 1 : 0
  );
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Standings
        </h2>
        <span className="tnum text-[11px] text-faint">PORTFOLIO VALUE · LIVE</span>
      </div>
      <div className="mt-2 border-t hairline">
        {ranked.map((a, i) => (
          <AgentRow
            key={a.id}
            a={a}
            rank={i + 1}
            price={price}
            trade={lastTrade(trades, a.id)}
            isWinner={winnerId !== null && BigInt(a.id) === winnerId}
          />
        ))}
      </div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowSquareOut, Flag, Trophy } from "@phosphor-icons/react";
import type { FeedItem } from "@/lib/arena";
import { AGENTS, EXPLORER_TX, fmtMon } from "@/lib/chain";

function ts(t: number): string {
  return new Date(t * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Row({ item }: { item: FeedItem }) {
  const time = <span className="tnum shrink-0 text-faint">{ts(item.ts)}</span>;
  const link = (
    <a
      href={EXPLORER_TX(item.tx)}
      target="_blank"
      rel="noreferrer"
      className="ml-auto shrink-0 text-faint transition-colors hover:text-bone"
      aria-label="view transaction"
    >
      <ArrowSquareOut size={13} />
    </a>
  );

  if (item.kind === "trade") {
    const a = AGENTS[item.agentId];
    return (
      <div className="flex items-center gap-3 border-b hairline px-1 py-2.5 text-[13px] last:border-b-0">
        {time}
        <span
          className={`tnum w-11 shrink-0 text-[10px] font-bold tracking-[0.08em] ${
            item.isBuy ? "text-acid" : "text-blood"
          }`}
        >
          {item.isBuy ? "BUY" : "SELL"}
        </span>
        <span className="truncate text-bone">
          <span className="font-medium">{a.name}</span>
          <span className="tnum text-ash">
            {" "}
            {item.isBuy
              ? `${fmtMon(item.amountIn)} MON → ${fmtMon(item.amountOut)} CTX`
              : `${fmtMon(item.amountIn)} CTX → ${fmtMon(item.amountOut)} MON`}{" "}
            @ {fmtMon(item.price)}
          </span>
        </span>
        {link}
      </div>
    );
  }
  if (item.kind === "bet") {
    const a = AGENTS[item.agentId];
    return (
      <div className="flex items-center gap-3 border-b hairline px-1 py-2.5 text-[13px] last:border-b-0">
        {time}
        <span className="tnum w-11 shrink-0 text-[10px] font-bold tracking-[0.08em] text-bone">
          BET
        </span>
        <span className="truncate text-ash">
          <span className="tnum">{fmtMon(item.amount)} MON</span> on{" "}
          <span className="font-medium text-bone">{a.name}</span>
        </span>
        {link}
      </div>
    );
  }
  if (item.kind === "settle") {
    const a = AGENTS[Number(item.winnerAgentId)];
    return (
      <div className="flex items-center gap-3 border-b hairline-acid bg-[rgba(163,230,53,0.05)] px-1 py-2.5 text-[13px] last:border-b-0">
        {time}
        <Trophy size={14} weight="fill" className="shrink-0 text-acid" />
        <span className="truncate text-bone">
          Round <span className="tnum">#{item.roundId.toString()}</span> settled —{" "}
          <span className="font-medium">{a.name}</span> wins @{" "}
          <span className="tnum">{fmtMon(item.endPrice)}</span>
          {item.refundMode && (
            <span className="text-faint"> · bets refundable</span>
          )}
        </span>
        {link}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 border-b hairline px-1 py-2.5 text-[13px] last:border-b-0">
      {time}
      <Flag size={14} className="shrink-0 text-faint" />
      <span className="truncate text-ash">
        Round <span className="tnum text-bone">#{item.roundId.toString()}</span>{" "}
        started @ <span className="tnum text-bone">{fmtMon(item.startPrice)}</span>
      </span>
      {link}
    </div>
  );
}

export function ActivityFeed({ feed }: { feed: FeedItem[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Activity
        </h2>
        <span className="tnum text-[11px] text-faint">ONCHAIN · NEWEST FIRST</span>
      </div>
      <div className="slim-scroll mt-2 max-h-[380px] overflow-y-auto border-t hairline">
        {feed.length === 0 && (
          <p className="py-8 text-center text-[13px] text-faint">
            No onchain activity in this window yet.
          </p>
        )}
        {feed.map((f) => (
          <motion.div
            key={f.key}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Row item={f} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

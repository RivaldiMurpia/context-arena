"use client";

import { useEffect, useRef, useState } from "react";
import { PriceChart } from "./PriceChart";
import type { FeedItem, PricePoint, RoundInfo } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";

type TradeItem = Extract<FeedItem, { kind: "trade" }>;

function FlashPrice({ value }: { value: bigint }) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current) {
      setFlash("up");
      const t = setTimeout(() => setFlash(null), 450);
      prev.current = value;
      return () => clearTimeout(t);
    }
    if (value < prev.current) {
      setFlash("down");
      const t = setTimeout(() => setFlash(null), 450);
      prev.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);
  const cls =
    flash === "up" ? "text-acid" : flash === "down" ? "text-blood" : "text-bone";
  return (
    <span className={`tnum text-5xl font-semibold tracking-tight transition-colors duration-150 md:text-6xl ${cls}`}>
      {fmtMon(value)}
    </span>
  );
}

/**
 * The price board: one framed panel holding the live price, the chart and
 * the session stats — reads as a single broadcast unit instead of loose
 * fragments on the page background.
 */
export function LiveSection({
  price,
  priceHistory,
  round,
  roundTrades,
  trades = [],
}: {
  price: bigint;
  priceHistory: PricePoint[];
  round: RoundInfo | null;
  roundTrades: number;
  trades?: TradeItem[];
}) {
  const start = round?.startPrice ?? null;
  const chg =
    start && start > 0n ? Number(((price - start) * 10000n) / start) / 100 : 0;
  const up = chg >= 0;

  let hi = 0n;
  let lo = 0n;
  for (const p of priceHistory) {
    if (hi === 0n || p.price > hi) hi = p.price;
    if (lo === 0n || p.price < lo) lo = p.price;
  }

  return (
    <section className="overflow-hidden rounded-2xl border hairline bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 pt-4">
        <span className="flex items-center gap-3">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" aria-hidden />
          <span className="tnum text-[11px] tracking-[0.18em] text-ash">
            CTX / MON — LIVE
          </span>
        </span>
        {start !== null && (
          <span
            className={`tnum rounded-full border px-2.5 py-0.5 text-[12px] ${
              up
                ? "hairline-acid text-acid"
                : "border-[rgba(251,113,133,0.25)] text-blood"
            }`}
          >
            {up ? "+" : ""}
            {chg.toFixed(2)}% since open
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 px-5 pt-2">
        <FlashPrice value={price} />
        <span className="tnum pb-1.5 text-sm text-faint">MON per CTX</span>
      </div>

      <div className="mt-3 border-t hairline py-3">
        <PriceChart
          data={priceHistory}
          startPrice={start}
          trades={trades}
          height={300}
        />
      </div>

      <div className="tnum grid grid-cols-3 divide-x divide-white/[0.08] border-t hairline text-[12px]">
        <div className="px-4 py-2.5">
          <div className="text-[10px] tracking-[0.14em] text-faint">HIGH</div>
          <div className="mt-0.5 text-bone">{hi ? fmtMon(hi) : "—"}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[10px] tracking-[0.14em] text-faint">LOW</div>
          <div className="mt-0.5 text-bone">{lo ? fmtMon(lo) : "—"}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[10px] tracking-[0.14em] text-faint">AGENT TRADES</div>
          <div className="mt-0.5 text-bone">{roundTrades}</div>
        </div>
      </div>
    </section>
  );
}

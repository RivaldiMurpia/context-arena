"use client";

import { useEffect, useRef, useState } from "react";
import { PriceChart } from "./PriceChart";
import type { PricePoint, RoundInfo } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";

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

export function LiveSection({
  price,
  priceHistory,
  round,
  roundId,
  roundTrades,
}: {
  price: bigint;
  priceHistory: PricePoint[];
  round: RoundInfo | null;
  roundId: bigint | null;
  roundTrades: number;
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
    <section className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-acid" />
        <span className="tnum text-[11px] tracking-[0.18em] text-ash">
          CTX / MON — LIVE
        </span>
        {roundId !== null && (
          <span className="tnum text-[11px] text-faint">ROUND {roundId.toString()}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
        <FlashPrice value={price} />
        <span className="tnum pb-2 text-sm text-faint">MON per CTX</span>
        {start !== null && (
          <span
            className={`tnum mb-2 rounded-full border px-2.5 py-0.5 text-[12px] ${
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

      <div className="mt-4 border-y hairline py-2">
        <PriceChart data={priceHistory} startPrice={start} height={250} />
      </div>

      <div className="tnum mt-3 grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <div className="text-[10px] tracking-[0.14em] text-faint">HIGH</div>
          <div className="mt-0.5 text-bone">{hi ? fmtMon(hi) : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.14em] text-faint">LOW</div>
          <div className="mt-0.5 text-bone">{lo ? fmtMon(lo) : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.14em] text-faint">AGENT TRADES</div>
          <div className="mt-0.5 text-bone">{roundTrades}</div>
        </div>
      </div>
    </section>
  );
}

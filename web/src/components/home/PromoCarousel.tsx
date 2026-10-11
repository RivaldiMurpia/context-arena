"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { fmtCountdown, phaseOf } from "@/hooks/useArena";
import type { PricePoint, RoundInfo } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";

interface Props {
  status: "loading" | "live" | "error";
  roundId: bigint | null;
  hasActive: boolean;
  price: bigint;
  priceHistory: PricePoint[];
  round: RoundInfo | null;
  now: number;
}

function Sparkline({ points }: { points: PricePoint[] }) {
  const pts = points.slice(-80);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => Number(p.price));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const path = vals
    .map(
      (v, i) =>
        `${((i / (vals.length - 1)) * 200).toFixed(1)},${(58 - ((v - min) / span) * 50).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 200 64"
      preserveAspectRatio="none"
      className="h-10 w-full"
      aria-hidden
    >
      <polyline
        points={path}
        fill="none"
        stroke="#a3e635"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Broadcast hero: oversized expanded headline with the live market strip
 * running across the bottom of the same panel (price + sparkline, round,
 * countdown, pool). Secondary messages rotate inside the headline block;
 * the data strip never rotates — it is the page's heartbeat.
 */
export function PromoCarousel({
  status,
  roundId,
  hasActive,
  price,
  priceHistory,
  round,
  now,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  const phase = phaseOf(round, hasActive, now);
  const target =
    phase === "betting"
      ? Number(round!.bettingCloseTime)
      : phase === "trading"
        ? Number(round!.endTime)
        : null;
  const roundLive = status === "live" && hasActive && roundId !== null;

  const slides = [
    {
      key: "live",
      kicker: "LIVE ON MONAD TESTNET",
      title: "Watch AI trade. Bet on the winner.",
      body: roundLive
        ? `Round ${roundId.toString()} is ${phase === "betting" ? `taking bets for ${target !== null ? fmtCountdown(target, now) : "—"}` : "trading live"}. Three agents, one pool, zero house.`
        : "Three AI agents trade CTX live onchain. Back the winner with MON and split the pool.",
      cta: { label: "Enter the Arena", href: "/arena", primary: false, external: false },
    },
    {
      key: "pari",
      kicker: null,
      title: "No house. No spread.",
      body: "Winners split the losing pool. Odds move with the crowd and every payout settles onchain.",
      cta: { label: "How it works", href: "/#how", primary: false, external: false },
    },
    {
      key: "faucet",
      kicker: null,
      title: "Need testnet MON?",
      body: "The faucet drips free MON. Grab some and join the next round — it costs nothing but attention.",
      cta: { label: "Get MON", href: "https://faucet.monad.xyz", primary: false, external: true },
    },
  ];

  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      6000
    );
    return () => clearInterval(id);
  }, [paused, reduce, slides.length]);

  const s = slides[idx];

  return (
    <section
      aria-label="Highlights"
      className="relative mt-5 overflow-hidden rounded-2xl border hairline bg-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 130% at 82% 12%, rgba(163,230,53,0.09), transparent 70%)",
        }}
        aria-hidden
      />

      {/* Headline block (rotating) */}
      <div className="grid grid-cols-1 gap-8 px-6 pt-10 pb-8 sm:px-10 md:pt-14">
        <div className="max-w-[820px]">
          {s.kicker && (
            <p className="tnum text-[11px] tracking-[0.22em] text-acid">
              {s.kicker}
            </p>
          )}
          <h1 className="font-display font-wide mt-4 text-5xl leading-[0.98] font-extrabold tracking-tight text-balance md:text-7xl">
            {s.title}
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ash">
            {s.body}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {s.cta.primary ? (
              <Link
                href={s.cta.href}
                tabIndex={0}
                className="focus-ring inline-flex h-12 items-center rounded-full bg-acid px-7 text-[15px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
              >
                {s.cta.label}
              </Link>
            ) : s.cta.external ? (
              <a
                href={s.cta.href}
                target="_blank"
                rel="noreferrer"
                tabIndex={0}
                className="focus-ring tnum inline-flex h-12 items-center gap-2 rounded-full border hairline px-7 text-[14px] text-bone transition-colors hover:border-white/25"
              >
                {s.cta.label}
                <ArrowSquareOut size={14} />
              </a>
            ) : (
              <Link
                href={s.cta.href}
                tabIndex={0}
                className="focus-ring inline-flex h-12 items-center rounded-full border hairline px-7 text-[14px] font-medium whitespace-nowrap text-bone transition-colors hover:border-white/25"
              >
                {s.cta.label}
              </Link>
            )}

            <div className="flex gap-2 pl-1" role="tablist" aria-label="Slides">
              {slides.map((sl, i) => (
                <button
                  key={sl.key}
                  onClick={() => setIdx(i)}
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    i === idx ? "w-8 bg-bone" : "w-4 bg-white/15 hover:bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live market strip: full-width, never rotates */}
      <div className="tnum grid grid-cols-2 divide-x divide-white/[0.08] border-t hairline text-[12px] md:grid-cols-4">
        <div className="px-5 py-4">
          <div className="text-[10px] tracking-[0.16em] text-faint">
            CTX / MON
          </div>
          <div className="mt-1 text-xl font-semibold text-bone md:text-2xl">
            {price > 0n ? fmtMon(price, 4) : "—"}
          </div>
          <div className="mt-1.5 max-w-[160px]">
            <Sparkline points={priceHistory} />
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] tracking-[0.16em] text-faint">ROUND</div>
          <div className="mt-1 text-xl font-semibold text-bone md:text-2xl">
            {roundId !== null ? `#${roundId.toString()}` : "—"}
          </div>
          <div className="mt-1.5 text-[11px] text-ash">
            {roundLive ? (phase === "betting" ? "BETTING OPEN" : "TRADING") : "IDLE"}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] tracking-[0.16em] text-faint">
            {phase === "betting" ? "BETTING CLOSES" : "ROUND ENDS"}
          </div>
          <div className="mt-1 text-xl font-semibold text-bone md:text-2xl">
            {target !== null ? fmtCountdown(target, now) : "—"}
          </div>
          <div className="mt-1.5 text-[11px] text-ash">
            {phase === "settling" ? "SETTLING…" : "10-MIN ROUNDS"}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] tracking-[0.16em] text-faint">
            BET POOL
          </div>
          <div className="mt-1 text-xl font-semibold text-acid md:text-2xl">
            {round ? fmtMon(round.betPool, 2) : "—"}
          </div>
          <div className="mt-1.5 text-[11px] text-ash">MON · PARIMUTUEL</div>
        </div>
      </div>
    </section>
  );
}

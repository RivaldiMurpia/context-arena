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
      className="h-16 w-full"
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
      cta: { label: "Enter the Arena", href: "/arena", primary: true },
      visual: true,
    },
    {
      key: "pari",
      kicker: null,
      title: "No house. No spread.",
      body: "Winners split the losing pool. Odds move with the crowd and every payout settles onchain.",
      cta: { label: "How it works", href: "/#how", primary: false },
      visual: false,
    },
    {
      key: "faucet",
      kicker: null,
      title: "Need testnet MON?",
      body: "The faucet drips free MON. Grab some and join the next round — it costs nothing but attention.",
      cta: {
        label: "Get MON",
        href: "https://faucet.monad.xyz",
        primary: false,
        external: true,
      },
      visual: false,
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
            "radial-gradient(60% 130% at 82% 18%, rgba(163,230,53,0.09), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="grid">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`col-start-1 row-start-1 transition-opacity duration-200 ${
              i === idx ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={i !== idx}
          >
            <div className="grid grid-cols-1 gap-6 p-6 sm:p-8 md:grid-cols-[1.4fr_1fr] md:p-10">
              <div className="flex max-w-[560px] flex-col justify-center">
                {s.kicker && (
                  <p className="tnum text-[11px] tracking-[0.22em] text-acid">
                    {s.kicker}
                  </p>
                )}
                <h1
                  className={`font-display font-wide mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight text-balance md:text-6xl ${
                    s.key === "live" ? "" : "text-3xl md:text-5xl"
                  }`}
                >
                  {s.title}
                </h1>
                <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-ash">
                  {s.body}
                </p>
                <div className="mt-6">
                  {s.cta.primary ? (
                    <Link
                      href={s.cta.href}
                      tabIndex={i === idx ? 0 : -1}
                      className="inline-flex h-11 items-center rounded-full bg-acid px-6 text-[14px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
                    >
                      {s.cta.label}
                    </Link>
                  ) : s.cta.external ? (
                    <a
                      href={s.cta.href}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={i === idx ? 0 : -1}
                      className="tnum inline-flex h-11 items-center gap-2 rounded-full border hairline px-6 text-[13px] text-bone transition-colors hover:border-white/25"
                    >
                      {s.cta.label}
                      <ArrowSquareOut size={14} />
                    </a>
                  ) : (
                    <Link
                      href={s.cta.href}
                      tabIndex={i === idx ? 0 : -1}
                      className="inline-flex h-11 items-center rounded-full border hairline px-6 text-[14px] font-medium whitespace-nowrap text-bone transition-colors hover:border-white/25"
                    >
                      {s.cta.label}
                    </Link>
                  )}
                </div>
              </div>
              <div className="hidden flex-col justify-center md:flex">
                {s.visual ? (
                  <div className="rounded-2xl border hairline bg-obsidian/70 p-5">
                    <p className="tnum text-[10px] tracking-[0.2em] text-faint">
                      CTX / MON
                    </p>
                    <p className="tnum mt-1 text-[28px] font-semibold text-bone">
                      {price > 0n ? fmtMon(price, 4) : "—"}
                    </p>
                    <div className="mt-2">
                      <Sparkline points={priceHistory} />
                    </div>
                    <div className="tnum mt-3 flex justify-between border-t hairline pt-3 text-[11px] text-ash">
                      <span>
                        POOL{" "}
                        <span className="text-bone">
                          {round ? fmtMon(round.betPool, 2) : "—"}
                        </span>
                      </span>
                      <span>
                        ROUND{" "}
                        <span className="text-bone">
                          {roundId !== null ? roundId.toString() : "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-6 flex gap-2 sm:left-8 md:left-10">
        {slides.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-200 ${
              i === idx ? "w-8 bg-bone" : "w-4 bg-white/15 hover:bg-white/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

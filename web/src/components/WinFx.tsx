"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { motion, useReducedMotion } from "motion/react";
import { Trophy, X } from "@phosphor-icons/react";
import { readClaimed, readMyBets, type RoundInfo } from "@/lib/arena";
import { AGENTS, fmtMon } from "@/lib/chain";

const COLORS = ["#a3e635", "#e8b34b", "#7cc4e8", "#5ec8b8", "#f2f5ec"];

/**
 * One-shot canvas confetti burst. Lightweight on purpose — 80 rects on a
 * single fixed canvas, self-cancels after ~2.6s. Skipped entirely under
 * prefers-reduced-motion (WinFx never mounts it in that case).
 */
function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: 80 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 140,
      y: h * 0.22,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 5,
    }));

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const el = now - t0;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const alpha = Math.max(0, 1 - el / 2400);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (el < 2600) raf = requestAnimationFrame(frame);
      else onDone();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden
    />
  );
}

/**
 * Settlement moment: a one-time confetti burst when the round the viewer is
 * watching settles live (never on page load into an already-settled round),
 * plus a dismissible banner for the settled round with the viewer's own
 * payout surfaced when they backed the winner.
 */
export function WinFx({
  round,
  roundId,
}: {
  round: RoundInfo | null;
  roundId: bigint | null;
}) {
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(false);
  const [dismissed, setDismissed] = useState<bigint | null>(null);
  const [myWin, setMyWin] = useState<bigint>(0n);
  const { address } = useAccount();
  const prevSettled = useRef(false);
  const prevRound = useRef<bigint | null>(null);
  const endBurst = useCallback(() => setBurst(false), []);

  // burst only on a live trading → settled transition of the same round
  useEffect(() => {
    const settledNow = !!round?.settled;
    const sameRound =
      prevRound.current !== null && prevRound.current === roundId;
    if (settledNow && sameRound && !prevSettled.current && !reduceMotion) {
      setBurst(true);
    }
    if (prevRound.current !== roundId) {
      prevRound.current = roundId;
      prevSettled.current = settledNow;
    } else {
      prevSettled.current = settledNow;
    }
  }, [round?.settled, roundId, reduceMotion]);

  // viewer's own payout for the settled round (refund or win)
  useEffect(() => {
    if (!address || !round?.settled || roundId === null) {
      setMyWin(0n);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [bets, cl] = await Promise.all([
          readMyBets(roundId, address, 3),
          readClaimed(roundId, address),
        ]);
        if (!alive) return;
        if (round.refundMode) {
          setMyWin(cl ? 0n : bets.reduce((a, b) => a + b, 0n));
        } else {
          const mine = bets[Number(round.winnerAgentId)] ?? 0n;
          setMyWin(
            cl || mine === 0n || round.winningBets === 0n
              ? 0n
              : (mine * round.betPool) / round.winningBets
          );
        }
      } catch {
        /* rpc hiccup — leave as-is */
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    address,
    roundId,
    round?.settled,
    round?.refundMode,
    round?.winnerAgentId,
    round?.betPool,
    round?.winningBets,
  ]);

  return (
    <>
      {burst && <ConfettiBurst onDone={endBurst} />}
      {round?.settled && roundId !== null && dismissed !== roundId && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border hairline-acid bg-[rgba(163,230,53,0.06)] px-4 py-3 text-[13px]"
          role="status"
        >
          <Trophy
            weight="fill"
            size={18}
            className="shrink-0 text-acid"
            aria-hidden
          />
          <span className="text-bone">
            <span className="font-semibold">
              {AGENTS[Number(round.winnerAgentId)]?.name ?? "Agent"}{" "}
              wins round #{roundId.toString()}
            </span>{" "}
            <span className="tnum text-ash">
              @ {fmtMon(round.endPrice)} · pool {fmtMon(round.betPool)} MON
              {round.refundMode ? " · bets refundable" : ""}
            </span>
          </span>
          {myWin > 0n && (
            <span className="tnum text-acid">
              {round.refundMode
                ? `your bets are refundable — ${fmtMon(myWin)} MON`
                : `you won ${fmtMon(myWin)} MON`}
            </span>
          )}
          <button
            onClick={() => setDismissed(roundId)}
            aria-label="Dismiss round result"
            className="ml-auto rounded p-1 text-faint transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/70"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </>
  );
}

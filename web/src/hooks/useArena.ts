"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  findRoundStartBlock,
  publicClient,
  readAgent,
  readBasics,
  readRound,
  scanEvents,
  type AgentState,
  type FeedItem,
  type PricePoint,
  type RoundInfo,
} from "@/lib/arena";
import { AGENTS, POLL_MS } from "@/lib/chain";

export interface ArenaState {
  status: "loading" | "live" | "error";
  error: string | null;
  price: bigint;
  priceHistory: PricePoint[];
  round: RoundInfo | null;
  roundId: bigint | null;
  hasActive: boolean;
  agents: AgentState[];
  feed: FeedItem[];
  roundCount: bigint;
  now: number; // unix seconds, ticks every second
  roundTrades: number;
}

const FEED_CAP = 60;

export function useArena(): ArenaState {
  const [state, setState] = useState<ArenaState>({
    status: "loading",
    error: null,
    price: 0n,
    priceHistory: [],
    round: null,
    roundId: null,
    hasActive: false,
    agents: [],
    feed: [],
    roundCount: 0n,
    now: Math.floor(Date.now() / 1000),
    roundTrades: 0,
  });

  const lastBlock = useRef<bigint>(0n);
  const bootedRound = useRef<bigint | null>(null);
  const busy = useRef(false);
  const tradeCount = useRef(0);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const b = await readBasics();

      if (b.roundCount === 0n) {
        setState((s) => ({
          ...s,
          status: "live",
          price: b.price,
          roundCount: 0n,
          hasActive: false,
        }));
        return;
      }

      const rid = b.roundCount - 1n; // latest round (active or just settled)

      // (re)seed when the round changes
      if (bootedRound.current !== rid) {
        bootedRound.current = rid;
        const startBlock = await findRoundStartBlock(rid, b.blockNumber);
        const { prices, feed } = await scanEvents(startBlock, b.blockNumber);
        lastBlock.current = b.blockNumber;
        tradeCount.current = feed.filter((f) => f.kind === "trade").length;
        setState((s) => ({
          ...s,
          priceHistory: prices,
          feed: feed.slice(0, FEED_CAP),
          roundTrades: tradeCount.current,
        }));
      } else if (b.blockNumber > lastBlock.current) {
        const { prices, feed } = await scanEvents(
          lastBlock.current + 1n,
          b.blockNumber
        );
        lastBlock.current = b.blockNumber;
        if (prices.length || feed.length) {
          tradeCount.current += feed.filter((f) => f.kind === "trade").length;
          const tc = tradeCount.current;
          setState((s) => {
            const merged = [...s.priceHistory, ...prices].sort(
              (x, y) => x.t - y.t
            );
            // dedupe by timestamp
            const dedup = merged.filter(
              (p, i) => i === 0 || merged[i - 1].t !== p.t
            );
            const seen = new Set(s.feed.map((f) => f.key));
            const fresh = feed.filter((f) => !seen.has(f.key));
            return {
              ...s,
              priceHistory: dedup.slice(-400),
              feed: [...fresh, ...s.feed].slice(0, FEED_CAP),
              roundTrades: tc,
            };
          });
        }
      }

      const [round, ...agentStates] = await Promise.all([
        readRound(rid),
        ...AGENTS.map((a) => readAgent(rid, a.id, b.price)),
      ]);

      setState((s) => {
        // append a live price point (chart keeps breathing between events)
        const last = s.priceHistory[s.priceHistory.length - 1];
        const nowTs = Math.floor(Date.now() / 1000);
        let priceHistory = s.priceHistory;
        if (!last || (nowTs - last.t >= 4 && last.price !== b.price)) {
          priceHistory = [...s.priceHistory, { t: nowTs, price: b.price }].slice(-400);
        }
        return {
          ...s,
          status: "live",
          error: null,
          price: b.price,
          priceHistory,
          round,
          roundId: rid,
          hasActive: b.hasActive,
          agents: agentStates,
          roundCount: b.roundCount,
        };
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        status: s.priceHistory.length ? "live" : "error",
        error: e instanceof Error ? e.message : "RPC unreachable",
      }));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, POLL_MS);
    const clock = setInterval(
      () => setState((s) => ({ ...s, now: Math.floor(Date.now() / 1000) })),
      1000
    );
    // keep viem's block cache warm-ish without spamming
    void publicClient;
    return () => {
      clearInterval(id);
      clearInterval(clock);
    };
  }, [tick]);

  return state;
}

export function phaseOf(
  round: RoundInfo | null,
  hasActive: boolean,
  now: number
): "betting" | "trading" | "settling" | "settled" | "idle" {
  if (!round) return "idle";
  if (round.settled) return "settled";
  if (!hasActive) return "settling";
  if (now <= Number(round.bettingCloseTime)) return "betting";
  return "trading";
}

export function fmtCountdown(targetTs: number, now: number): string {
  const d = Math.max(0, targetTs - now);
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

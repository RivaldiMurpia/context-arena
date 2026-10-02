"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  blockTimestamp,
  publicClient,
  readClaimed,
  readRound,
  scanMyBetLogs,
} from "@/lib/arena";

export interface MyBid {
  key: string;
  roundId: bigint;
  agentId: number;
  amount: bigint;
  tx: `0x${string}`;
  ts: number;
  status: "pending" | "won" | "lost" | "refund";
  /** gross payout in wei when won/refund, null otherwise */
  payout: bigint | null;
  claimed: boolean;
}

const MAX_BETS = 25;
// Rounds are ~2.5s blocks on Monad; 120k blocks is a generous lookback.
const LOOKBACK_BLOCKS = 120_000n;

/**
 * The connected wallet's own bets, newest first, each joined with its
 * round outcome. Reads BetPlaced events filtered by bettor (indexed topic),
 * so no full-chain scan is needed.
 */
export function useMyBids() {
  const { address, isConnected } = useAccount();
  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;
    let dead = false;
    (async () => {
      setLoading(true);
      try {
        const latest = await publicClient.getBlockNumber();
        const from = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
        const logs = await scanMyBetLogs(address, from, latest);
        const out: MyBid[] = [];
        for (const l of logs.slice(0, MAX_BETS)) {
          const r = await readRound(l.roundId);
          let status: MyBid["status"] = "pending";
          let payout: bigint | null = null;
          let claimed = false;
          if (r.settled) {
            if (r.refundMode) {
              status = "refund";
              payout = l.amount;
            } else if (Number(r.winnerAgentId) === l.agentId) {
              status = "won";
              payout =
                r.winningBets > 0n
                  ? (l.amount * r.betPool) / r.winningBets
                  : null;
            } else {
              status = "lost";
            }
            claimed = await readClaimed(l.roundId, address);
          }
          const ts = await blockTimestamp(l.blockNumber);
          out.push({
            key: `${l.tx}-${l.roundId}-${l.agentId}`,
            roundId: l.roundId,
            agentId: l.agentId,
            amount: l.amount,
            tx: l.tx,
            ts,
            status,
            payout,
            claimed,
          });
          if (dead) return;
        }
        if (!dead) setBids(out);
      } catch {
        /* keep previous; section shows empty state */
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [address, isConnected]);

  return { bids, loading };
}

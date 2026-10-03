"use client";

import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { MyBid } from "@/hooks/useMyBids";
import { AGENTS, ARENA_ADDRESS, EXPLORER_TX, fmtMon, shortHash } from "@/lib/chain";
import { ABI } from "@/lib/arena";
import { AgentMark } from "@/components/home/AgentMark";

/** Claim button for a settled-but-unclaimed bid (refund or win). */
function ClaimButton({ bid }: { bid: MyBid }) {
  const { writeContract, data: txHash, isPending, error, reset } =
    useWriteContract();
  const { isLoading: mining, isSuccess: done } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const claimed = bid.claimed || done;

  if (claimed || bid.claimed) {
    const label = bid.status === "refund" ? "REFUNDED" : "CLAIMED";
    return (
      <span className="tnum text-[12px] text-faint">
        {bid.status === "refund" ? "REFUND · " : ""}
        {label}
      </span>
    );
  }

  const label = `Claim ${fmtMon(bid.payout ?? bid.amount, 2)} MON`;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={() => {
          reset();
          writeContract({
            address: ARENA_ADDRESS,
            abi: ABI,
            functionName: "claim",
            args: [bid.roundId],
          });
        }}
        disabled={isPending || mining}
        className="tnum rounded-lg bg-acid px-3 py-1.5 text-[12px] font-semibold text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending
          ? "Confirm in wallet…"
          : mining
            ? "Claiming…"
            : label}
      </button>
      {error && (
        <span className="tnum max-w-[180px] text-right text-[10px] text-red-400">
          Failed — retry
        </span>
      )}
    </span>
  );
}

export function BidResult({ bid }: { bid: MyBid }) {
  if (bid.status === "pending")
    return (
      <span className="tnum inline-flex items-center gap-1.5 text-[12px] text-ash">
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-acid" />
        LIVE
      </span>
    );
  if (bid.status === "lost")
    return <span className="tnum text-[12px] text-faint">LOST</span>;
  if (bid.status === "refund")
    return (
      <span className="tnum text-[12px] text-ash">
        {bid.claimed ? "REFUNDED" : <ClaimButton bid={bid} />}
      </span>
    );
  // won
  const profit = bid.payout !== null ? bid.payout - bid.amount : null;
  return (
    <span className="tnum inline-flex flex-col items-end gap-1 text-[13px] font-medium text-acid">
      <span>
        +{profit !== null ? fmtMon(profit, 2) : "?"}
        <span className="ml-1.5 text-[10px] text-faint">MON</span>
      </span>
      {bid.claimed ? (
        <span className="text-[10px] text-faint">CLAIMED</span>
      ) : (
        <ClaimButton bid={bid} />
      )}
    </span>
  );
}

/** The connected wallet's bets, newest first. Shared by /history and /profile. */
export function MyBidTable({
  bids,
  loading,
  limit,
}: {
  bids: MyBid[];
  loading: boolean;
  limit?: number;
}) {
  const rows = limit ? bids.slice(0, limit) : bids;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="tnum grid grid-cols-[0.5fr_1.2fr_1fr_1fr_0.6fr] gap-4 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
          <span>ROUND</span>
          <span>AGENT</span>
          <span className="text-right">AMOUNT</span>
          <span className="text-right">RESULT</span>
          <span className="text-right">TX</span>
        </div>
        {loading &&
          rows.length === 0 &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_0.6fr] gap-4 border-b hairline py-4 last:border-b-0"
            >
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="skeleton h-4 rounded-md bg-white/[0.06]" />
              ))}
            </div>
          ))}
        {rows.map((b) => (
          <div
            key={b.key}
            className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_0.6fr] items-center gap-4 border-b hairline py-3.5 last:border-b-0"
          >
            <span className="tnum text-[13px] text-faint">
              {b.roundId.toString()}
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              <AgentMark id={b.agentId} size="sm" />
              <span className="truncate text-[14px] font-medium text-bone">
                {AGENTS[b.agentId]?.name ?? "—"}
              </span>
            </span>
            <span className="tnum text-right text-[13px] text-ash">
              {fmtMon(b.amount, 2)} MON
            </span>
            <span className="text-right">
              <BidResult bid={b} />
            </span>
            <span className="text-right">
              <a
                href={EXPLORER_TX(b.tx)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-bone"
              >
                {shortHash(b.tx)}
                <ArrowSquareOut size={11} />
              </a>
            </span>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[13px] text-faint">
              No bets yet —{" "}
              <Link href="/arena" className="text-acid hover:brightness-110">
                place your first bet in the arena
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

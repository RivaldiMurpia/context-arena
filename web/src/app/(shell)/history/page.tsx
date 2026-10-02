"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowSquareOut, Trophy, Wallet } from "@phosphor-icons/react";
import { useHallOfFame } from "@/hooks/useHallOfFame";
import { useMyBids, type MyBid } from "@/hooks/useMyBids";
import { useProfile } from "@/hooks/useProfile";
import { useWalletUI } from "@/components/WalletUI";
import { UsernameModal } from "@/components/ProfileButton";
import { AGENTS, EXPLORER_TX, fmtMon, shortHash } from "@/lib/chain";
import { AgentMark } from "@/components/home/AgentMark";

function WinnersTable() {
  const { entries, loading } = useHallOfFame(30);

  return (
    <section aria-label="Round winners" className="mt-8">
      <h2 className="font-display text-[20px] font-bold tracking-tight">
        Winners
      </h2>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="tnum grid grid-cols-[0.6fr_1.4fr_1fr_0.8fr] gap-4 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
            <span>ROUND</span>
            <span>WINNER</span>
            <span className="text-right">END PRICE</span>
            <span className="text-right">PAYOUT</span>
          </div>
          {loading &&
            entries.length === 0 &&
            [0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[0.6fr_1.4fr_1fr_0.8fr] gap-4 border-b hairline py-4 last:border-b-0"
              >
                <div className="skeleton h-4 rounded-md bg-white/[0.06]" />
                <div className="skeleton h-4 rounded-md bg-white/[0.06]" />
                <div className="skeleton h-4 rounded-md bg-white/[0.06]" />
                <div className="skeleton h-4 rounded-md bg-white/[0.06]" />
              </div>
            ))}
          {entries.map((e) => (
            <div
              key={e.roundId.toString()}
              className="grid grid-cols-[0.6fr_1.4fr_1fr_0.8fr] items-center gap-4 border-b hairline py-3.5 last:border-b-0"
            >
              <span className="tnum text-[13px] text-faint">
                {e.roundId.toString()}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <AgentMark id={e.winnerAgentId} size="sm" />
                <span className="truncate text-[14px] font-medium text-bone">
                  {AGENTS[e.winnerAgentId]?.name ?? "—"}
                </span>
              </span>
              <span className="tnum text-right text-[13px] text-ash">
                {fmtMon(e.endPrice, 4)}
              </span>
              <span className="text-right">
                {e.payoutX !== null ? (
                  <span className="tnum text-[14px] font-medium text-acid">
                    {e.payoutX.toFixed(2)}×
                  </span>
                ) : (
                  <span className="tnum text-[12px] text-faint">REFUND</span>
                )}
              </span>
            </div>
          ))}
          {!loading && entries.length === 0 && (
            <p className="py-10 text-center text-[13px] text-faint">
              No settled rounds yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MyBids() {
  const { isConnected } = useAccount();
  const { openWallet } = useWalletUI();
  const { bids, loading } = useMyBids();
  const { profile, loading: profileLoading, unavailable } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isConnected) {
    return (
      <section aria-label="My bids" className="mt-12">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          My bids
        </h2>
        <div className="mt-3 flex flex-col items-start gap-4 rounded-2xl border hairline bg-panel p-6 sm:p-8">
          <Wallet size={28} className="text-acid" />
          <div>
            <p className="font-display text-[16px] font-semibold tracking-tight">
              Connect your wallet to see your bids
            </p>
            <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-ash">
              Every bet you place is onchain. Connect and your full bid history
              appears here.
            </p>
          </div>
          <button
            onClick={openWallet}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-acid px-6 text-[14px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
          >
            <Wallet size={16} weight="bold" />
            Connect Wallet
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="My bids" className="mt-12">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          My bids
        </h2>
        {profile ? (
          <span className="tnum rounded-full border hairline px-3 py-1 text-[11px] text-acid">
            @{profile.username}
          </span>
        ) : (
          !unavailable &&
          !profileLoading && (
            <button
              onClick={() => setModalOpen(true)}
              className="tnum rounded-full border border-acid/40 px-3 py-1 text-[11px] text-acid transition hover:brightness-110"
            >
              Set a username
            </button>
          )
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="tnum grid grid-cols-[0.5fr_1.2fr_1fr_1fr_0.6fr] gap-4 border-b hairline pb-2.5 text-[10px] tracking-[0.16em] text-faint">
            <span>ROUND</span>
            <span>AGENT</span>
            <span className="text-right">AMOUNT</span>
            <span className="text-right">RESULT</span>
            <span className="text-right">TX</span>
          </div>
          {loading &&
            bids.length === 0 &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_0.6fr] gap-4 border-b hairline py-4 last:border-b-0"
              >
                {[0, 1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="skeleton h-4 rounded-md bg-white/[0.06]"
                  />
                ))}
              </div>
            ))}
          {bids.map((b) => (
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
          {!loading && bids.length === 0 && (
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
      {modalOpen && <UsernameModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}

function BidResult({ bid }: { bid: MyBid }) {
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
        REFUND{bid.claimed ? "" : "ABLE"}
      </span>
    );
  // won
  const profit =
    bid.payout !== null ? bid.payout - bid.amount : null;
  return (
    <span className="tnum text-[13px] font-medium text-acid">
      +{profit !== null ? fmtMon(profit, 2) : "?"}
      <span className="ml-1.5 text-[10px] text-faint">
        {bid.claimed ? "CLAIMED" : "UNCLAIMED"}
      </span>
    </span>
  );
}

export default function HistoryPage() {
  return (
    <div className="pt-8 pb-16">
      <div className="flex items-center gap-3">
        <Trophy size={26} className="text-acid" />
        <h1 className="font-display font-wide text-3xl font-extrabold tracking-tight md:text-4xl">
          History
        </h1>
      </div>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ash">
        Every settled round and its winner, read straight from the contract.{" "}
        <Link
          href="/arena"
          className="text-bone underline decoration-white/20 underline-offset-4 transition-colors hover:text-acid"
        >
          Back to the live arena
        </Link>
        .
      </p>
      <WinnersTable />
      <MyBids />
    </div>
  );
}

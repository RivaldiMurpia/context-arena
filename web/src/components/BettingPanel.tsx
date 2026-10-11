"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import type { AgentState, RoundInfo } from "@/lib/arena";
import { ABI, readClaimed, readMyBets } from "@/lib/arena";
import { AGENTS, ARENA_ADDRESS, fmtMon } from "@/lib/chain";
import { phaseOf } from "@/hooks/useArena";
import { useWalletUI } from "./WalletUI";
import { AgentMark } from "./home/AgentMark";

function odds(betsOn: bigint, pool: bigint): string {
  if (betsOn === 0n || pool === 0n) return "—";
  const x = Number((pool * 100n) / betsOn) / 100;
  return `${x.toFixed(2)}×`;
}

const QUICK_AMOUNTS = ["1", "5", "10"];

export function BettingPanel({
  round,
  roundId,
  agents,
  hasActive,
  now,
}: {
  round: RoundInfo | null;
  roundId: bigint | null;
  agents: AgentState[];
  hasActive: boolean;
  now: number;
}) {
  const { address, isConnected } = useAccount();
  const { openWallet } = useWalletUI();
  const [pick, setPick] = useState(0);
  const [amount, setAmount] = useState("1");
  const [myBets, setMyBets] = useState<bigint[]>([0n, 0n, 0n]);
  const [claimed, setClaimed] = useState(false);

  const { writeContract, data: txHash, isPending: txPending, error: txError, reset } =
    useWriteContract();
  const { isSuccess: txDone } = useWaitForTransactionReceipt({ hash: txHash });

  const phase = phaseOf(round, hasActive, now);
  const bettingOpen = phase === "betting";

  // refresh my bets / claimed state
  useEffect(() => {
    if (!address || roundId === null) return;
    let alive = true;
    const load = async () => {
      try {
        const [bets, cl] = await Promise.all([
          readMyBets(roundId, address, agents.length || 3),
          readClaimed(roundId, address),
        ]);
        if (alive) {
          setMyBets(bets);
          setClaimed(cl);
        }
      } catch {
        /* rpc hiccup — keep old values */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address, roundId, agents.length, txDone]);

  const claimable = (() => {
    if (!round?.settled || claimed || roundId === null) return 0n;
    if (round.refundMode) return myBets.reduce((a, b) => a + b, 0n);
    const w = Number(round.winnerAgentId);
    const mine = myBets[w] ?? 0n;
    if (mine === 0n || round.winningBets === 0n) return 0n;
    return (mine * round.betPool) / round.winningBets;
  })();

  // Live payout preview for the current pick + amount. Once I have already
  // bet on this agent this round, the amount rides on top of that stake —
  // same math the contract settlement uses (amount * pool / winningBets).
  const payoutPreview = (() => {
    if (phase !== "betting") return null;
    const v = parseFloat(amount);
    if (!Number.isFinite(v) || v <= 0 || !round) return null;
    let amt: bigint;
    try {
      amt = parseEther(amount || "0");
    } catch {
      return null; // malformed amount ("1.2.3") — hide preview, don't crash
    }
    const picked = agents.find((x) => x.id === pick);
    if (!picked) return null;
    const onPick = picked.betsOn + amt;
    const pool = round.betPool + amt;
    const iWin = myBets[pick] ? myBets[pick] + amt : amt;
    const mult = Number((pool * 100n) / onPick) / 100;
    return { payout: (iWin * pool) / onPick, mult };
  })();

  const myTotal = myBets.reduce((a, b) => a + b, 0n);

  const placeBet = () => {
    const v = parseFloat(amount);
    if (!Number.isFinite(v) || v <= 0) return;
    let value: bigint;
    try {
      value = parseEther(amount); // rejects malformed input like "1.2.3"
    } catch {
      return; // payoutPreview already hides; never crash the panel
    }
    reset();
    writeContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "placeBet",
      args: [BigInt(pick)],
      value,
    });
  };

  const claim = () => {
    if (roundId === null) return;
    reset();
    writeContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "claim",
      args: [roundId],
    });
  };

  return (
    <aside className="flex flex-col rounded-2xl border hairline bg-panel p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Back a trader
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-faint">
        Bet MON on who finishes the round with the biggest portfolio. Winners
        split the pool.
      </p>

      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Pick a trader">
        {AGENTS.map((a) => {
          const st = agents.find((x) => x.id === a.id);
          const selected = pick === a.id;
          const poolPct =
            st && round && round.betPool > 0n
              ? Number((st.betsOn * 100n) / round.betPool)
              : 0;
          return (
            <button
              key={a.id}
              role="radio"
              aria-checked={selected}
              onClick={() => setPick(a.id)}
              disabled={!bettingOpen}
              className={`focus-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.99] ${
                selected
                  ? "hairline-acid bg-[rgba(163,230,53,0.06)]"
                  : "hairline hover:border-[rgba(255,255,255,0.18)]"
              } ${!bettingOpen ? "opacity-50" : ""}`}
            >
              <AgentMark id={a.id} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-bone">
                  {a.name}
                </span>
                <span className="tnum block text-[11px] text-faint">
                  {st ? `${fmtMon(st.betsOn)} MON backed` : "—"}
                </span>
                <span
                  className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]"
                  title={`${poolPct}% of the bet pool`}
                >
                  <span
                    className="block h-full bg-acid transition-[width] duration-500"
                    style={{ width: `${poolPct}%` }}
                  />
                </span>
              </span>
              <span className="text-right">
                <span className="tnum block text-[15px] font-semibold text-acid">
                  {st && round ? odds(st.betsOn, round.betPool) : "—"}
                </span>
                <span className="block text-[10px] tracking-[0.1em] text-faint">
                  ODDS
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label
            htmlFor="bet-amount"
            className="text-[10px] tracking-[0.14em] text-faint"
          >
            AMOUNT
          </label>
          <div className="tnum flex gap-1.5">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                disabled={!bettingOpen}
                className={`focus-ring rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-150 disabled:opacity-40 ${
                  amount === q
                    ? "hairline-acid text-acid"
                    : "hairline text-ash hover:text-bone"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex items-center rounded-xl border hairline bg-void px-3 transition-colors focus-within:border-[rgba(163,230,53,0.45)]">
          <input
            id="bet-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            disabled={!bettingOpen}
            className="tnum w-full bg-transparent py-2.5 text-[16px] text-bone outline-none placeholder:text-faint"
            placeholder="0.00"
          />
          <span className="tnum text-[12px] text-faint">MON</span>
        </div>
        {payoutPreview && (
          <p className="tnum mt-1.5 text-[11px] text-ash">
            if <span className="text-bone">{AGENTS[pick].name}</span> wins ≈{" "}
            <span className="text-acid">{fmtMon(payoutPreview.payout)} MON</span>{" "}
            <span className="text-faint">({payoutPreview.mult.toFixed(2)}×)</span>
          </p>
        )}
      </div>

      {!isConnected ? (
        <button
          onClick={openWallet}
          className="focus-ring mt-4 w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Connect wallet to bet
        </button>
      ) : (
        <button
          onClick={placeBet}
          disabled={!bettingOpen || txPending}
          className="focus-ring mt-4 w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
        >
          {!bettingOpen
            ? "Betting closed"
            : txPending
              ? "Confirm in wallet…"
              : `Bet ${amount || "0"} MON on ${AGENTS[pick].name}`}
        </button>
      )}

      {txError && (
        <p className="mt-2 text-[12px] text-blood">
          {(txError as Error).message.split("\n")[0].slice(0, 90)}
        </p>
      )}
      {txDone && (
        <p className="tnum mt-2 text-[12px] text-acid">
          Confirmed — good luck.
        </p>
      )}

      {isConnected && myTotal > 0n && (
        <div className="mt-5 border-t hairline pt-4">
          <div className="text-[10px] tracking-[0.14em] text-faint">
            YOUR POSITION
          </div>
          <div className="tnum mt-2 space-y-1.5 text-[13px]">
            {AGENTS.map((a, i) =>
              myBets[i] > 0n ? (
                <div key={a.id} className="flex justify-between">
                  <span className="text-ash">{a.name}</span>
                  <span className="text-bone">{fmtMon(myBets[i])} MON</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {isConnected && claimable > 0n && (
        <button
          onClick={claim}
          disabled={txPending}
          className="focus-ring tnum mt-4 w-full rounded-full border hairline-acid py-2.5 text-[14px] font-semibold text-acid transition-all hover:bg-[rgba(163,230,53,0.08)] active:scale-[0.98]"
        >
          {txPending ? "Confirm in wallet…" : `Claim ${fmtMon(claimable)} MON`}
        </button>
      )}
    </aside>
  );
}

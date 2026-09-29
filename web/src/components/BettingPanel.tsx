"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther } from "viem";
import type { AgentState, RoundInfo } from "@/lib/arena";
import { ABI, readClaimed, readMyBets } from "@/lib/arena";
import { AGENTS, ARENA_ADDRESS, fmtMon } from "@/lib/chain";
import { phaseOf } from "@/hooks/useArena";

function odds(betsOn: bigint, pool: bigint): string {
  if (betsOn === 0n || pool === 0n) return "—";
  const x = Number((pool * 100n) / betsOn) / 100;
  return `${x.toFixed(2)}×`;
}

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
  const { connect, isPending: connectPending } = useConnect();
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

  const myTotal = myBets.reduce((a, b) => a + b, 0n);

  const placeBet = () => {
    const v = parseFloat(amount);
    if (!Number.isFinite(v) || v <= 0) return;
    reset();
    writeContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "placeBet",
      args: [BigInt(pick)],
      value: parseEther(amount),
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
    <aside className="flex flex-col border hairline bg-obsidian p-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Back a trader
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-faint">
        Bet MON on who finishes the round with the biggest portfolio. Winners
        split the pool.
      </p>

      <div className="mt-4 space-y-2">
        {AGENTS.map((a) => {
          const st = agents.find((x) => x.id === a.id);
          const selected = pick === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setPick(a.id)}
              disabled={!bettingOpen}
              className={`flex w-full items-center justify-between border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.99] ${
                selected
                  ? "hairline-acid bg-[rgba(163,230,53,0.06)]"
                  : "hairline hover:border-[rgba(255,255,255,0.18)]"
              } ${!bettingOpen ? "opacity-50" : ""}`}
            >
              <span>
                <span className="block text-[14px] font-medium text-bone">
                  {a.name}
                </span>
                <span className="tnum block text-[11px] text-faint">
                  {st ? `${fmtMon(st.betsOn)} MON backed` : "—"}
                </span>
              </span>
              <span className="text-right">
                <span className="tnum block text-[15px] font-semibold text-acid">
                  {st && round ? odds(st.betsOn, round.betPool) : "—"}
                </span>
                <span className="block text-[10px] tracking-[0.1em] text-faint">
                  PAYOUT
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label
          htmlFor="bet-amount"
          className="text-[10px] tracking-[0.14em] text-faint"
        >
          AMOUNT
        </label>
        <div className="mt-1.5 flex items-center border hairline bg-void px-3 focus-within:hairline-acid">
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
      </div>

      {!isConnected ? (
        <button
          onClick={() => connect({ connector: injected() })}
          disabled={connectPending}
          className="mt-4 w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98]"
        >
          {connectPending ? "Connecting…" : "Connect wallet to bet"}
        </button>
      ) : (
        <button
          onClick={placeBet}
          disabled={!bettingOpen || txPending}
          className="mt-4 w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
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
          className="tnum mt-4 w-full rounded-full border hairline-acid py-2.5 text-[14px] font-semibold text-acid transition-all hover:bg-[rgba(163,230,53,0.08)] active:scale-[0.98]"
        >
          {txPending ? "Confirm in wallet…" : `Claim ${fmtMon(claimable)} MON`}
        </button>
      )}
    </aside>
  );
}

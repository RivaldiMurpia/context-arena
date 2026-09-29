import { ARENA_ADDRESS, EXPLORER_ADDR, shortAddr } from "@/lib/chain";
import { ArrowSquareOut } from "@phosphor-icons/react";

const STEPS = [
  {
    n: "01",
    title: "Pick a trader",
    body: "Three AI agents trade one synthetic asset, CTX, with 100 MON of virtual capital each. Degen Dan apes momentum, The Professor buys dips, Whale waits for dislocation.",
  },
  {
    n: "02",
    title: "Bet before the window closes",
    body: "Betting stays open for the first 7 minutes of each 10-minute round. Odds are parimutuel — the payout on your pick floats with the pool.",
  },
  {
    n: "03",
    title: "Winner takes the pool",
    body: "Highest portfolio value at round end wins. Backers split the pool pro-rata and claim onchain. If nobody backed the winner, every bet is refundable.",
  },
];

const SPECS: [string, string][] = [
  ["CONTRACT", shortAddr(ARENA_ADDRESS)],
  ["NETWORK", "Monad testnet · 10143"],
  ["ROUND", "10 min · betting 7 min"],
  ["ASSET", "CTX / MON · synthetic"],
  ["SETTLEMENT", "parimutuel · onchain claim"],
];

export function HowItWorks() {
  return (
    <section className="grid grid-cols-1 gap-8 border-t hairline pt-10 md:grid-cols-12">
      <div className="md:col-span-7">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          How it works
        </h2>
        <div className="mt-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="grid grid-cols-[3rem_1fr] gap-4 border-b hairline py-5 last:border-b-0"
            >
              <span className="tnum text-xl text-acid">{s.n}</span>
              <div>
                <div className="font-display text-[16px] font-semibold tracking-tight">
                  {s.title}
                </div>
                <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ash">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:col-span-5">
        <h3 className="tnum text-[11px] tracking-[0.18em] text-faint">
          UNDER THE HOOD
        </h3>
        <dl className="mt-3 border-t hairline">
          {SPECS.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between border-b hairline py-2.5 text-[13px]"
            >
              <dt className="tnum text-[11px] tracking-[0.12em] text-faint">{k}</dt>
              <dd className="tnum text-bone">
                {k === "CONTRACT" ? (
                  <a
                    href={EXPLORER_ADDR(ARENA_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-acid"
                  >
                    {v}
                    <ArrowSquareOut size={12} />
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-faint">
          The CTX price is set by an offchain game master (random walk plus
          scheduled shocks) as part of the game design — it is not a
          decentralized oracle. Agent capital is virtual; only spectator bets
          move real MON.
        </p>
      </div>
    </section>
  );
}

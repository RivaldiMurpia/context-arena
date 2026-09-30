import { ARENA_ADDRESS, EXPLORER_ADDR } from "@/lib/chain";
import { ArrowSquareOut } from "@phosphor-icons/react";

export function ShellFooter() {
  return (
    <footer className="border-t hairline">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-8 text-[12px] leading-relaxed text-faint md:flex-row md:items-center md:justify-between md:px-6">
        <p className="max-w-[70ch]">
          Context Arena is a hackathon demo on Monad testnet — no real money.
          CTX prices come from the game master, agent funds are virtual, and
          only spectator bets move MON.
        </p>
        <div className="tnum flex shrink-0 items-center gap-4">
          <a
            href={EXPLORER_ADDR(ARENA_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            CONTRACT <ArrowSquareOut size={12} />
          </a>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            FAUCET <ArrowSquareOut size={12} />
          </a>
          <a
            href="https://github.com/RivaldiMurpia/context-arena"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-bone"
          >
            GITHUB <ArrowSquareOut size={12} />
          </a>
        </div>
      </div>
    </footer>
  );
}

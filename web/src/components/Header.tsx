"use client";

import Image from "next/image";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { ARENA_ADDRESS, EXPLORER_ADDR, shortAddr } from "@/lib/chain";
import { ProfileButton } from "./ProfileButton";

export function Header({ roundId, live }: { roundId: bigint | null; live: boolean }) {
  return (
    <header className="border-b hairline">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:px-6">
        <Image
          src="/logo-wordmark.png"
          alt="Context Arena"
          width={1869}
          height={177}
          className="h-auto w-[176px]"
          priority
        />
        <div className="flex items-baseline gap-3">
          <span className="hidden tnum text-[11px] text-faint sm:inline">
            AI TRADERS · ONCHAIN · MONAD
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {roundId !== null && (
            <span className="tnum hidden items-center gap-2 rounded-full border hairline px-3 py-1 text-[11px] text-ash sm:flex">
              <span className={`live-dot inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-acid" : "bg-faint"}`} />
              ROUND {roundId.toString()}
            </span>
          )}
          <a
            href={EXPLORER_ADDR(ARENA_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="tnum hidden items-center gap-1.5 rounded-full border hairline px-3 py-1 text-[11px] text-ash transition-colors hover:text-bone md:flex"
          >
            {shortAddr(ARENA_ADDRESS)}
            <ArrowSquareOut size={12} />
          </a>
          <ProfileButton />
        </div>
      </div>
    </header>
  );
}

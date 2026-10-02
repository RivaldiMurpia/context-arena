"use client";

import Link from "next/link";
import {
  ArrowSquareOut,
  List,
  MagnifyingGlass,
  Question,
} from "@phosphor-icons/react";
import { ProfileButton } from "@/components/ProfileButton";
import { useShell } from "./ShellContext";

export function TopBar() {
  const { query, setQuery, setDrawer } = useShell();

  return (
    <header className="sticky top-0 z-30 border-b hairline bg-void/85 backdrop-blur-md">
      <div className="flex h-[68px] items-center gap-3 px-4 md:px-6">
        <button
          onClick={() => setDrawer(true)}
          className="rounded-full p-2 text-ash transition-colors hover:text-bone lg:hidden"
          aria-label="Open navigation"
        >
          <List size={20} />
        </button>

        <label className="hidden h-10 max-w-[380px] flex-1 items-center gap-2.5 rounded-xl border hairline bg-panel px-3.5 sm:flex">
          <MagnifyingGlass size={16} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="w-full bg-transparent text-[13px] text-bone outline-none placeholder:text-faint"
            aria-label="Search agents"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/#how"
            className="hidden h-10 items-center gap-1.5 rounded-full border hairline px-4 text-[13px] text-ash transition-colors hover:border-white/20 hover:text-bone md:inline-flex"
          >
            <Question size={15} />
            How it Works
          </Link>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="tnum hidden h-10 items-center gap-1.5 rounded-full border hairline px-4 text-[13px] text-ash transition-colors hover:border-white/20 hover:text-bone md:inline-flex"
          >
            FAUCET
            <ArrowSquareOut size={13} />
          </a>
          <ProfileButton />
        </div>
      </div>
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowSquareOut,
  ClockCounterClockwise,
  House,
  Lightning,
  Question,
  X,
} from "@phosphor-icons/react";
import { ARENA_ADDRESS, EXPLORER_ADDR, shortAddr } from "@/lib/chain";
import { useShell } from "./ShellContext";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/arena", label: "Arena", icon: Lightning },
  { href: "/history", label: "History", icon: ClockCounterClockwise },
  { href: "/#how", label: "How it works", icon: Question },
];

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 pt-6 pb-2"
        aria-label="Context Arena home"
      >
        <Image
          src="/logo-wordmark.png"
          alt="Context Arena"
          width={1869}
          height={177}
          className="h-auto w-[200px]"
          priority
        />
      </Link>

      <nav className="mt-4 flex flex-col gap-1 px-3" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/#how" ? false : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors duration-150 ${
                active
                  ? "bg-elev font-semibold text-bone"
                  : "text-ash hover:bg-white/[0.04] hover:text-bone"
              }`}
            >
              <Icon
                size={19}
                weight={active ? "fill" : "regular"}
                className={active ? "text-acid" : undefined}
              />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-acid" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pb-5">
        <div className="rounded-2xl border hairline bg-panel p-4">
          <p className="tnum text-[10px] tracking-[0.18em] text-faint">
            AI TRADERS · LIVE
          </p>
          <p className="mt-2 text-[13px] leading-snug text-ash">
            Three bots. One winner. Bet MON on your pick.
          </p>
          <Link
            href="/arena"
            onClick={onNavigate}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-acid px-4 py-2 text-[13px] font-semibold text-void transition hover:brightness-110 active:scale-[0.98]"
          >
            Watch the arena
          </Link>
        </div>
        <div className="tnum mt-4 flex items-center gap-3 px-1 text-[11px] text-faint">
          <a
            href={EXPLORER_ADDR(ARENA_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-bone"
          >
            {shortAddr(ARENA_ADDRESS)}
            <ArrowSquareOut size={11} />
          </a>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-bone"
          >
            Faucet
          </a>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { drawer, setDrawer } = useShell();
  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r hairline bg-obsidian lg:block">
        <NavBody />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden ${
          drawer ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawer(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r hairline bg-obsidian transition-transform duration-200 ease-out lg:hidden ${
          drawer ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawer}
      >
        <button
          onClick={() => setDrawer(false)}
          className="absolute top-5 right-4 rounded-full p-1.5 text-ash transition-colors hover:text-bone"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        <NavBody onNavigate={() => setDrawer(false)} />
      </aside>
    </>
  );
}

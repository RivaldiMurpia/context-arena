import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://monad-testnet.api.onfinality.io/public",
        "https://testnet-rpc.monad.xyz",
      ],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

export const ARENA_ADDRESS =
  "0x3b1d866777a8f26494249dfa7047f1ec9ffab563" as const;

export const EXPLORER_TX = (h: string) =>
  `https://testnet.monadvision.com/tx/${h}`;
export const EXPLORER_ADDR = (a: string) =>
  `https://testnet.monadvision.com/address/${a}`;

export const AGENTS = [
  {
    id: 0,
    name: "Degen Dan",
    tagline: "Apes breakouts. Sells the top, sometimes.",
    style: "Momentum · trades constantly · 20–60% size",
  },
  {
    id: 1,
    name: "The Professor",
    tagline: "Buys dips, sells rips. Never chases.",
    style: "Mean reversion · 2–4 trades/round · 5–15% size",
  },
  {
    id: 2,
    name: "Whale",
    tagline: "Waits for dislocation. Then strikes.",
    style: "Patient giant · 1–2 big moves · 40–80% size",
  },
] as const;

export const POLL_MS = 5000;

/** MON value with 4 decimals, from 1e18 wei bigint. */
export function fmtMon(w: bigint, dp = 4): string {
  const neg = w < 0n;
  const v = neg ? -w : w;
  const int = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, dp);
  return `${neg ? "-" : ""}${int.toString()}.${frac}`;
}

export function fmtInt(n: bigint | number): string {
  return Number(n).toLocaleString("en-US");
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…`;
}

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(
  readFileSync(join(here, "ContextArena.artifact.json"), "utf8")
) as { abi: unknown[] };

// Chain definition for Monad testnet (EIP-1559 NOT supported -> legacy txs)
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz"] } },
});

export const ARENA_ABI = artifact.abi as any[];

export function arenaAddress(): Address {
  const a = process.env.ARENA_ADDRESS;
  if (!a || a === "0x0000000000000000000000000000000000000000") {
    throw new Error("ARENA_ADDRESS missing in bots/.env");
  }
  return a as Address;
}

export const demoMode = process.env.DEMO_MODE === "true";
// Normal: 10-min rounds, price tick 30s, agent acts every 60-90s
// Demo:   3-min rounds,  price tick 10s, agent acts every 30s
export const TIMING = demoMode
  ? { roundDuration: 180, bettingWindow: 120, priceTickMs: 10_000, agentActMs: 30_000 }
  : { roundDuration: 600, bettingWindow: 420, priceTickMs: 30_000, agentActMs: 75_000 };

export function publicClient() {
  return createPublicClient({ chain: monadTestnet, transport: http() });
}

export function walletClientFromKey(key: string) {
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({ account, chain: monadTestnet, transport: http() });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const toWad = (x: number) => BigInt(Math.round(x * 1e18));
export const fromWad = (w: bigint) => Number(w) / 1e18;

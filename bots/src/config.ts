import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Chain definition for Monad testnet (EIP-1559 NOT supported -> legacy txs)
export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz"] } },
} as const;

if (!process.env.ARENA_ADDRESS) throw new Error("ARENA_ADDRESS missing in .env");
export const ARENA_ADDRESS = process.env.ARENA_ADDRESS as Address;

// TODO: paste the ABI of ContextArena here after `forge build`
// (or generate with `forge inspect ContextArena abi`)
export const ARENA_ABI: unknown[] = [];

export const demoMode = process.env.DEMO_MODE === "true";
// Normal: 10-min rounds, price tick 30s, agent acts every 60-90s
// Demo:   3-min rounds,  price tick 10s, agent acts every 30s
export const TIMING = demoMode
  ? { roundDuration: 180, bettingWindow: 120, priceTickMs: 10_000, agentActMs: 30_000 }
  : { roundDuration: 600, bettingWindow: 420, priceTickMs: 30_000, agentActMs: 75_000 };

export function publicClient(): PublicClient {
  return createPublicClient({ chain: monadTestnet, transport: http() });
}

export function walletClientFromKey(key: string): WalletClient {
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({ account, chain: monadTestnet, transport: http() });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

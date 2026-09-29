import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./config.js";

/**
 * Registers the 3 agent wallets onchain. Run once after funding them:
 *   npm run setup
 * Needs in bots/.env: DEPLOYER_KEY, ARENA_ADDRESS, AGENT_KEYS
 */

const NAMES = ["Degen Dan", "The Professor", "Whale"];

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(readFileSync(join(here, "ContextArena.artifact.json"), "utf8")) as {
  abi: unknown[];
};

async function main() {
  const deployerKey = process.env.DEPLOYER_KEY;
  const arena = process.env.ARENA_ADDRESS as Address | undefined;
  const keys = (process.env.AGENT_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!deployerKey) throw new Error("DEPLOYER_KEY missing in bots/.env");
  if (!arena) throw new Error("ARENA_ADDRESS missing in bots/.env");
  if (keys.length !== 3) throw new Error(`AGENT_KEYS must have 3 keys, got ${keys.length}`);

  const account = privateKeyToAccount(deployerKey as Hex);
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });
  const pub = createPublicClient({ chain: monadTestnet, transport: http() });

  for (let i = 0; i < 3; i++) {
    const agentAddr = privateKeyToAccount(keys[i] as Hex).address;
    console.log(`registering ${NAMES[i]} -> ${agentAddr}`);
    const hash = await wallet.writeContract({
      address: arena,
      abi: artifact.abi,
      functionName: "registerAgent",
      args: [NAMES[i], agentAddr],
      type: "legacy",
    });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  ok: ${hash}`);
  }

  const count = await pub.readContract({
    address: arena,
    abi: artifact.abi,
    functionName: "agentCount",
  });
  console.log(`agentCount onchain: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

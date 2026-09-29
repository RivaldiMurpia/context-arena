import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./config.js";

/**
 * Deploys ContextArena to Monad testnet with a legacy transaction
 * (Monad does NOT support EIP-1559).
 * Run: npm run deploy   (needs DEPLOYER_KEY in bots/.env)
 */

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(readFileSync(join(here, "ContextArena.artifact.json"), "utf8")) as {
  abi: unknown[];
  bytecode: { object: string };
};

async function main() {
  const key = process.env.DEPLOYER_KEY;
  if (!key) throw new Error("DEPLOYER_KEY missing in bots/.env");
  const account = privateKeyToAccount(key as Hex);

  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });
  const pub = createPublicClient({ chain: monadTestnet, transport: http() });

  const balance = await pub.getBalance({ address: account.address });
  console.log(`deployer ${account.address} | balance ${(Number(balance) / 1e18).toFixed(4)} MON`);
  if (balance === 0n) throw new Error("deployer has no MON — claim from the faucet first");

  console.log("deploying ContextArena (legacy tx)...");
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as Hex,
    type: "legacy",
  });
  console.log("tx hash:", hash);

  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log("deployed at:", receipt.contractAddress);
  console.log("explorer: https://testnet.monadvision.com/address/" + receipt.contractAddress);
  console.log("\nNext: put this address in bots/.env as ARENA_ADDRESS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

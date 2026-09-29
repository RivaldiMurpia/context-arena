import "dotenv/config";
import {
  ARENA_ABI,
  TIMING,
  arenaAddress,
  fromWad,
  publicClient,
  sleep,
  toWad,
  walletClientFromKey,
} from "./config.js";

/**
 * Game master bot: starts rounds, pushes the CTX price every tick
 * (random walk + drama shocks), settles finished rounds.
 * Run: npm run master   (needs GAME_MASTER_KEY + ARENA_ADDRESS in .env)
 */

// Box-Muller gaussian
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function nextPrice(current: number): number {
  let r = randn() * 0.02; // ~2% volatility per tick
  if (Math.random() < 0.05) r += (Math.random() < 0.5 ? -1 : 1) * 0.08; // 5%: drama shock
  return Math.max(0.01, current * (1 + r));
}

async function main() {
  if (!process.env.GAME_MASTER_KEY) throw new Error("GAME_MASTER_KEY missing in bots/.env");
  const arena = arenaAddress();
  const pub = publicClient();
  const wallet = walletClientFromKey(process.env.GAME_MASTER_KEY);
  const me = wallet.account?.address;
  if (!me) throw new Error("bad GAME_MASTER_KEY");
  console.log(`game master ${me} | arena ${arena} | demo=${process.env.DEMO_MODE === "true"}`);

  const DURATION = BigInt(TIMING.roundDuration);
  const BET_WINDOW = BigInt(TIMING.bettingWindow);
  let price = 1.0;

  async function startRound() {
    const cp = (await pub.readContract({
      address: arena, abi: ARENA_ABI, functionName: "currentPrice",
    })) as bigint;
    price = fromWad(cp);
    console.log(`starting new round @ price ${price.toFixed(4)}...`);
    const h = await wallet.writeContract({
      address: arena, abi: ARENA_ABI, functionName: "startRound",
      args: [DURATION, BET_WINDOW], type: "legacy",
    });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log(`round started: ${h}`);
  }

  for (;;) {
    try {
      const roundCount = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "roundCount",
      })) as bigint;

      if (roundCount === 0n) {
        await startRound();
      } else {
        const rid = roundCount - 1n;
        const r = (await pub.readContract({
          address: arena, abi: ARENA_ABI, functionName: "rounds", args: [rid],
        })) as unknown[];
        const settled = r[6] as boolean;
        const endTime = r[2] as bigint;

        if (!settled) {
          const now = BigInt(Math.floor(Date.now() / 1000));
          if (now >= endTime) {
            console.log(`round ${rid} ended, settling...`);
            const h = await wallet.writeContract({
              address: arena, abi: ARENA_ABI, functionName: "settleRound",
              args: [rid], type: "legacy",
            });
            await pub.waitForTransactionReceipt({ hash: h });
            console.log(`round ${rid} settled: ${h}`);
          } else {
            price = nextPrice(price);
            const h = await wallet.writeContract({
              address: arena, abi: ARENA_ABI, functionName: "pushPrice",
              args: [toWad(price)], type: "legacy",
            });
            console.log(`round ${rid} | CTX = ${price.toFixed(4)} MON (${h.slice(0, 10)}...)`);
          }
        } else {
          await startRound();
        }
      }
    } catch (e) {
      console.error("tick failed:", (e as Error).message?.slice(0, 160));
    }
    await sleep(TIMING.priceTickMs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import { ARENA_ABI, ARENA_ADDRESS, TIMING, publicClient, sleep, walletClientFromKey } from "./config.js";

/**
 * Game master bot:
 *  - starts rounds, pushes the CTX price every tick (random walk + drama shocks),
 *  - settles finished rounds.
 * Run: npm run master
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

const toWad = (x: number) => BigInt(Math.round(x * 1e18));

async function main() {
  if (!process.env.GAME_MASTER_KEY) throw new Error("GAME_MASTER_KEY missing");
  const pub = publicClient();
  const wallet = walletClientFromKey(process.env.GAME_MASTER_KEY);
  console.log(`game master ${wallet.account?.address} | demo=${process.env.DEMO_MODE}`);

  let price = 1.0; // MON per CTX, matches contract genesis

  for (;;) {
    // TODO: replace with real contract reads/writes once ARENA_ABI is filled
    // const active = await pub.readContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: "activeRound" });
    // if (!active) {
    //   await wallet.writeContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: "startRound",
    //     args: [BigInt(TIMING.roundDuration), BigInt(TIMING.bettingWindow)], type: "legacy" });
    //   console.log("round started");
    // }
    // price = nextPrice(price);
    // await wallet.writeContract({ address: ARENA_ADDRESS, abi: ARENA_ABI, functionName: "pushPrice",
    //   args: [toWad(price)], type: "legacy" });
    // ... check endTime -> settleRound
    console.log(`[skeleton] tick price=${price.toFixed(4)}`);
    price = nextPrice(price);
    await sleep(TIMING.priceTickMs);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

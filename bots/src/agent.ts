import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ARENA_ABI, ARENA_ADDRESS, TIMING, sleep, walletClientFromKey } from "./config.js";

/**
 * Trader agent bot. One process per agent:
 *   AGENT_INDEX=0 npm run agent  -> Degen Dan
 *   AGENT_INDEX=1 npm run agent  -> The Professor
 *   AGENT_INDEX=2 npm run agent  -> Whale
 *
 * Loop: read market state -> ask Gemini -> execute BUY/SELL/HOLD onchain.
 */

const PERSONALITIES = [
  {
    name: "Degen Dan",
    system: `You are Degen Dan, an aggressive momentum trader. You love breakouts, you ape into pumps,
you cut losses fast. You never sit still while others profit. Keep position sizes bold (20-60% of cash per trade).`,
  },
  {
    name: "The Professor",
    system: `You are The Professor, a cautious mean-reversion quant. You buy dips and sell rips,
you size positions small (5-15% of cash), you never chase green candles. Patience is your edge.`,
  },
  {
    name: "Whale",
    system: `You are Whale, a patient giant. You trade rarely but decisively: 1-2 big moves per round
(40-80% of cash). You wait for extreme dislocations, then strike. Small noise is beneath you.`,
  },
];

type Action = { action: "BUY" | "SELL" | "HOLD"; amount: number; reason: string };

async function decide(genAI: GoogleGenerativeAI, persona: string, market: string): Promise<Action> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `${persona}\n\nMarket state (CTX priced in MON):\n${market}\n\nRespond with ONLY valid JSON: {"action":"BUY"|"SELL"|"HOLD","amount":<number in MON for BUY, in CTX for SELL, 0 for HOLD>,"reason":"<one short sentence>"}`;
  const res = await model.generateContent(prompt);
  const text = res.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text) as Action;
}

async function main() {
  const idx = Number(process.env.AGENT_INDEX ?? 0);
  const persona = PERSONALITIES[idx];
  if (!persona) throw new Error("AGENT_INDEX must be 0, 1, or 2");
  const keys = (process.env.AGENT_KEYS ?? "").split(",").map((s) => s.trim());
  if (!keys[idx]) throw new Error(`AGENT_KEYS[${idx}] missing`);
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const wallet = walletClientFromKey(keys[idx]);
  console.log(`${persona.name} online: ${wallet.account?.address}`);

  for (;;) {
    try {
      // TODO: read real state via viem once ARENA_ABI is filled:
      // currentPrice, price history (PriceUpdated events), positions for all agents, time left
      const market = `currentPrice=1.00 MON/CTX, myCash=100 MON, myHoldings=0 CTX, timeLeft=600s (SKELETON DATA)`;
      const { action, amount, reason } = await decide(genAI, persona.system, market);
      console.log(`[${persona.name}] ${action} ${amount} :: ${reason}`);
      // TODO: wallet.writeContract agentBuy/agentSell with type: "legacy"
    } catch (e) {
      console.error(`[${persona.name}] decide failed, holding:`, (e as Error).message);
    }
    await sleep(TIMING.agentActMs);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

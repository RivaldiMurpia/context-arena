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
 * Trader agent bot. One process per agent:
 *   AGENT_INDEX=0 npm run agent  -> Degen Dan
 *   AGENT_INDEX=1 npm run agent  -> The Professor
 *   AGENT_INDEX=2 npm run agent  -> Whale
 * (Windows PowerShell: $env:AGENT_INDEX=0; npm run agent)
 *
 * Loop: read market state onchain -> ask LLM (Nebius -> Atria -> NIM fallback chain)
 *   -> execute BUY/SELL/HOLD.
 * Needs in bots/.env: at least one of NEBIUS_API_KEY / ATRIA_API_KEY / NVIDIA_API_KEY,
 * plus ARENA_ADDRESS and AGENT_KEYS
 */

const PERSONALITIES = [
  {
    name: "Degen Dan",
    system: `You are Degen Dan, an aggressive momentum trader. You love breakouts, you ape into pumps,
you cut losses fast. You never sit still while others profit. Keep position sizes bold (20-60% of cash per trade).`,
  },
  {
    name: "The Professor",
    system: `You are The Professor, a disciplined mean-reversion quant. You buy dips and sell rips,
you size positions small (5-15% of cash), you never chase green candles. Your rules:
- Only BUY when price is at least 3% below its recent average. A 1-2% wiggle is noise,
  not a setup — HOLD through it.
- SELL when price recovers to 2%+ above the average or above your buy price: mean reversion
  means completing the round trip, not holding forever.
- 2-4 trades per round is plenty. Patience is not passivity, but it is not hyperactivity
  either: holding cash the entire round guarantees you finish behind anyone who trades well.`,
  },
  {
    name: "Whale",
    system: `You are Whale, a patient giant. You trade rarely but decisively: 1-2 big moves per round
(40-80% of cash). Extreme dislocation means 8% or more away from the recent average — a 1-2%
wiggle is noise beneath you, HOLD through it. When a real dislocation comes, strike hard,
then go back to waiting. Small noise is beneath you.`,
  },
];

type Action = { action: "BUY" | "SELL" | "HOLD"; amount: number; reason: string };

type Provider = {
  name: string;
  baseUrl: string;
  model: string;
  key: string;
  disableThinking?: boolean;
};

// Fallback chain: Nebius (primary) -> Atria ASI -> NVIDIA NIM.
// (OpenCode Zen removed: its free tier 403s outside the OpenCode client.)
function llmProviders(): Provider[] {
  const clean = (u: string) => u.replace(/\/+$/, "");
  const list: Provider[] = [];
  if (process.env.NEBIUS_API_KEY) {
    list.push({
      name: "nebius",
      baseUrl: clean(process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1"),
      model: process.env.NEBIUS_MODEL ?? "nvidia/Nemotron-3_5-Lightning",
      key: process.env.NEBIUS_API_KEY,
      // Documented for Lightning on Token Factory: without this it burns ~all
      // output tokens on its thinking trace and returns truncated JSON.
      // Re-enable with NEBIUS_THINKING=1 if you ever want the trace back.
      disableThinking: process.env.NEBIUS_THINKING !== "1",
    });
  }
  if (process.env.ATRIA_API_KEY) {
    list.push({
      name: "atria",
      baseUrl: clean(process.env.ATRIA_BASE_URL ?? "https://api.atria-asi.ai/v1"),
      model: process.env.ATRIA_MODEL ?? "Atria-Dawn-Preview",
      key: process.env.ATRIA_API_KEY,
    });
  }
  if (process.env.NVIDIA_API_KEY) {
    list.push({
      name: "nim",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: process.env.NIM_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b",
      key: process.env.NVIDIA_API_KEY,
    });
  }
  return list;
}

// Don't hammer a provider that just rate-limited us: 429 -> 5min, 503 -> 2min.
const providerCooldown = new Map<string, number>();
function cooldownFor(err: string): number {
  if (/429|rate limit/i.test(err)) return 5 * 60_000;
  if (/503|overloaded|unavailable/i.test(err)) return 2 * 60_000;
  return 0;
}

// Pull out every balanced {...} candidate, ignoring <think> traces and stray
// braces in prose. The first candidate that parses AND validates wins — this
// survives reasoning models that leak "{" into their thinking text, which the
// greedy first-{→last-} regex above chokes on.
function extractJsonCandidates(text: string): string[] {
  const clean = text
    .replace(/```json|```/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "");
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const start = clean.indexOf("{", i);
    if (start === -1) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let j = start; j < clean.length; j++) {
      const c = clean[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) break;
    out.push(clean.slice(start, end + 1));
    i = end + 1;
  }
  return out;
}

async function callChat(
  p: Provider,
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<string> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300,
      // Raw-fetch equivalent of SDK extra_body: top-level passthrough field.
      ...(p.disableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string; code?: string | number };
  };
  const choice = data.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  if (!text) {
    // Some gateways return HTTP 200 with an error payload (or an upstream that
    // produced nothing). Surface the real reason instead of a bare "empty response".
    const upstream = data.error?.message ?? data.error?.code ?? "";
    const fr = choice?.finish_reason ? ` finish_reason=${choice.finish_reason}` : "";
    const why = upstream ? ` (upstream: ${String(upstream).slice(0, 120)})` : "";
    throw new Error(`${p.name}: empty response${why}${fr}`);
  }
  return text;
}

function parseAction(providerName: string, text: string): Action {
  for (const c of extractJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(c) as Action;
      if (!["BUY", "SELL", "HOLD"].includes(parsed.action)) continue;
      if (!Number.isFinite(parsed.amount) || parsed.amount < 0) parsed.amount = 0;
      if (typeof parsed.reason !== "string") parsed.reason = "";
      return parsed;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`${providerName}: not valid JSON`);
}

async function decide(persona: string, market: string): Promise<Action & { via: string }> {
  const providers = llmProviders();
  if (providers.length === 0)
    throw new Error("set NEBIUS_API_KEY, ATRIA_API_KEY, or NVIDIA_API_KEY in bots/.env");
  const system =
    persona +
    '\n\nRespond with ONLY a valid JSON object, nothing else — no greetings, no explanations, no markdown: {"action":"BUY"|"SELL"|"HOLD","amount":<number in MON for BUY, in CTX for SELL, 0 for HOLD>,"reason":"<one short sentence>"}';
  const user = `Market state (CTX priced in MON):\n${market}`;
  let lastErr = "";
  for (const p of providers) {
    const until = providerCooldown.get(p.name) ?? 0;
    if (Date.now() < until) {
      console.error(`  llm ${p.name} cooling down, skipping`);
      continue;
    }
    // Up to 2 attempts per provider: if the model answers in prose instead of
    // JSON, nudge it once (with its own bad answer as context) before moving on.
    const base = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    let messages = base;
    let providerErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 45_000);
      let text = "";
      try {
        text = await callChat(p, messages, ctrl.signal);
        const parsed = parseAction(p.name, text);
        return { ...parsed, via: p.name };
      } catch (e) {
        providerErr = (e as Error).message?.slice(0, 160) ?? String(e);
        const fixable = /not valid JSON|bad action|empty response/i.test(providerErr);
        if (process.env.LLM_DEBUG === "true" && /not valid JSON/i.test(providerErr) && text) {
          console.error(`  llm ${p.name} raw output: ${text.slice(0, 800)}`);
        }
        if (attempt === 0 && fixable && text) {
          console.error(`  llm ${p.name} format error, retrying with JSON-only nudge...`);
          messages = [
            ...base,
            { role: "assistant", content: text.slice(0, 800) },
            { role: "user", content: "That was not valid JSON. Do not include thinking or analysis. Reply with ONLY the JSON object, no other text." },
          ];
          continue;
        }
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
    lastErr = providerErr;
    const cd = cooldownFor(lastErr);
    if (cd > 0) providerCooldown.set(p.name, Date.now() + cd);
    console.error(`  llm ${p.name} failed, trying next: ${lastErr}`);
  }
  throw new Error(lastErr || "all LLM providers failed");
}

async function main() {
  const idx = Number(process.env.AGENT_INDEX ?? 0);
  const persona = PERSONALITIES[idx];
  if (!persona) throw new Error("AGENT_INDEX must be 0, 1, or 2");
  const keys = (process.env.AGENT_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!keys[idx]) throw new Error(`AGENT_KEYS[${idx}] missing in bots/.env`);
  if (!process.env.NEBIUS_API_KEY && !process.env.ATRIA_API_KEY && !process.env.NVIDIA_API_KEY)
    throw new Error("set NEBIUS_API_KEY (primary), ATRIA_API_KEY, or NVIDIA_API_KEY in bots/.env");

  const arena = arenaAddress();
  const pub = publicClient();
  const wallet = walletClientFromKey(keys[idx]);
  const me = wallet.account?.address;
  if (!me) throw new Error("bad agent key");
  console.log(`${persona.name} online: ${me} | arena ${arena}`);
  // Random startup delay so the 3 agents don't hammer the LLM APIs in lockstep.
  const jitterMs = Math.floor(Math.random() * 45_000);
  console.log(`${persona.name} starting in ${Math.round(jitterMs / 1000)}s...`);
  await sleep(jitterMs);

  const priceHistory: number[] = [];

  for (;;) {
    try {
      const active = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "activeRound",
      })) as boolean;
      if (!active) {
        console.log(`[${persona.name}] no active round, waiting...`);
        await sleep(TIMING.agentActMs);
        continue;
      }

      const roundCount = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "roundCount",
      })) as bigint;
      const rid = roundCount - 1n;

      const r = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "rounds", args: [rid],
      })) as unknown[];
      const timeLeft = Math.max(0, Number(r[2] as bigint) - Math.floor(Date.now() / 1000));

      const price = fromWad((await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "currentPrice",
      })) as bigint);
      priceHistory.push(price);
      if (priceHistory.length > 20) priceHistory.shift();
      const prev = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : price;
      const chg = ((price - prev) / prev) * 100;
      const avg = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;

      const posOf = async (agentId: number) => {
        const p = (await pub.readContract({
          address: arena, abi: ARENA_ABI, functionName: "positions",
          args: [rid, BigInt(agentId)],
        })) as [bigint, bigint];
        return { cash: fromWad(p[0]), hold: fromWad(p[1]) };
      };
      const mine = await posOf(idx);
      const myTotal = mine.cash + mine.hold * price;
      const rivals: string[] = [];
      for (let j = 0; j < 3; j++) {
        if (j === idx) continue;
        const p = await posOf(j);
        rivals.push(`${PERSONALITIES[j].name} ${(p.cash + p.hold * price).toFixed(1)} MON`);
      }

      const market =
        `Round #${rid}, ${timeLeft}s left. CTX price ${price.toFixed(4)} MON (${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% since your last check, avg of last ${priceHistory.length} checks ${avg.toFixed(4)} MON).\n` +
        `Your portfolio: ${mine.cash.toFixed(1)} MON cash + ${mine.hold.toFixed(1)} CTX (= ${(mine.hold * price).toFixed(1)} MON) = ${myTotal.toFixed(1)} MON total.\n` +
        `Rivals: ${rivals.join(", ")}.\n` +
        `Winner = highest portfolio value when the round ends.`;

      const { action, amount, reason, via } = await decide(persona.system, market);
      console.log(`[${persona.name}] ${action} ${amount} :: ${reason} (via ${via})`);

      // The LLM call took seconds; the game master may have settled the round
      // meanwhile (positions reset on a new round). Re-check before trading so
      // we don't send a doomed tx that reverts with "insufficient holdings"
      // or "no active round".
      const roundNow = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "roundCount",
      })) as bigint;
      const activeNow = (await pub.readContract({
        address: arena, abi: ARENA_ABI, functionName: "activeRound",
      })) as boolean;
      if (!activeNow || roundNow - 1n !== rid) {
        console.log(`[${persona.name}] round changed during decision, skipping trade`);
      } else if (action === "BUY" && amount > 0) {
        const buyAmt = Math.min(amount, mine.cash);
        if (buyAmt > 0.001) {
          const h = await wallet.writeContract({
            address: arena, abi: ARENA_ABI, functionName: "agentBuy",
            args: [BigInt(idx), toWad(buyAmt)], type: "legacy",
          });
          console.log(`  bought ${buyAmt.toFixed(2)} MON worth of CTX (${h.slice(0, 10)}...)`);
        }
      } else if (action === "SELL" && amount > 0) {
        const sellAmt = Math.min(amount, mine.hold);
        if (sellAmt > 0.001) {
          const h = await wallet.writeContract({
            address: arena, abi: ARENA_ABI, functionName: "agentSell",
            args: [BigInt(idx), toWad(sellAmt)], type: "legacy",
          });
          console.log(`  sold ${sellAmt.toFixed(2)} CTX (${h.slice(0, 10)}...)`);
        }
      }
    } catch (e) {
      console.error(`[${persona.name}] tick failed:`, (e as Error).message?.slice(0, 160));
    }
    await sleep(TIMING.agentActMs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { NextRequest, NextResponse } from "next/server";

// Same-origin RPC proxy. Browsers on unknown networks (judges, demo viewers)
// may not reach third-party Monad RPCs directly (CORS, egress blocks,
// per-IP rate limits). This route forwards read-only JSON-RPC calls from
// Vercel's servers, which have reliable egress, with upstream failover.
const UPSTREAMS = [
  "https://monad-testnet.api.onfinality.io/public",
  "https://testnet-rpc.monad.xyz",
];

// Read-only methods the dashboard needs. No transaction submission here;
// writes go through the user's own wallet.
const ALLOW = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_gasPrice",
  "eth_estimateGas",
]);

// Crude per-IP rate limit (per function instance).
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 120;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_HITS) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  arr.push(now);
  hits.set(ip, arr);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const items = Array.isArray(body) ? body : [body];
  for (const it of items) {
    const m =
      it && typeof it === "object"
        ? (it as { method?: unknown }).method
        : undefined;
    if (typeof m !== "string" || !ALLOW.has(m)) {
      return NextResponse.json(
        { error: `method not allowed: ${String(m)}` },
        { status: 403 }
      );
    }
  }

  let lastErr = "no upstream";
  for (const url of UPSTREAMS) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 12_000);
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        const text = await r.text();
        return new NextResponse(text, {
          status: r.status,
          headers: { "content-type": "application/json" },
        });
      } finally {
        clearTimeout(to);
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return NextResponse.json(
    { error: `upstream unreachable: ${lastErr}` },
    { status: 502 }
  );
}

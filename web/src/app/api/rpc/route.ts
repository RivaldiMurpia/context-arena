import { NextRequest, NextResponse } from "next/server";

// Same-origin RPC proxy. Browsers on unknown networks (judges, demo viewers)
// may not reach third-party Monad RPCs directly (CORS, egress blocks,
// per-IP rate limits). This route forwards read-only JSON-RPC calls from
// Vercel's servers, which have reliable egress, with upstream failover,
// retry-with-backoff on rate limits, and a short response cache.
// Upstream failover order. If ALCHEMY_RPC_URL is set (Vercel env var),
// Alchemy goes first — higher rate limits, dedicated quota.
function getUpstreams(): string[] {
  const list = [
    "https://monad-testnet.api.onfinality.io/public",
    "https://rpc.ankr.com/monad_testnet",
    "https://monad-testnet.drpc.org",
    "https://testnet-rpc.monad.xyz",
  ];
  const alchemy = (process.env.ALCHEMY_RPC_URL || "").trim();
  if (alchemy.startsWith("https://")) list.unshift(alchemy);
  return list;
}

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
  "eth_getBalance",
  "eth_getTransactionReceipt",
]);

// Crude per-IP rate limit (per function instance).
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 120;

// Short response cache (per function instance). The dashboard's first paint
// replays identical getLogs scans for every visitor; caching them slashes
// upstream load and makes repeat visits instant.
const cache = new Map<string, { at: number; body: string }>();
function cacheTtlMs(method: string): number {
  if (method === "eth_getLogs") return 45_000;
  if (method === "eth_call") return 8_000;
  return 5_000;
}
function cacheKey(body: unknown): string {
  return JSON.stringify(body);
}
const MAX_CACHE = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(text: string, status: number): boolean {
  if (status === 429) return true;
  const t = text.toLowerCase();
  return (
    t.includes("too many requests") ||
    t.includes("rate limit") ||
    t.includes("rate-limit") ||
    t.includes("throttl") ||
    t.includes("exceeded") ||
    t.includes("quota")
  );
}

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
  let method = "";
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
    method = m;
  }

  const key = cacheKey(body);
  const ttl = cacheTtlMs(method);
  const hit = cache.get(key);
  if (hit && now - hit.at < ttl) {
    return new NextResponse(hit.body, {
      headers: {
        "content-type": "application/json",
        "x-rpc-cache": "hit",
      },
    });
  }

  const failures: string[] = [];
  const upstreams = getUpstreams();
  for (const url of upstreams) {
    // Retry rate-limited upstreams with backoff before failing over:
    // OnFinality is the only endpoint that serves large getLogs ranges,
    // the others just burn time when it's throttling.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt * 1000);
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 8_000);
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: ctl.signal,
          });
          const text = await r.text();
          if (!r.ok) {
            failures.push(`${host(url)} http ${r.status}`);
            if (isRateLimit(text, r.status)) continue; // backoff + retry
            break; // non-retryable HTTP error -> next upstream
          }
          if (isRetryableRpcError(text)) {
            failures.push(`${host(url)} rpc-error`);
            if (isRateLimit(text, 200)) continue; // backoff + retry
            break; // e.g. "block range too large" -> next upstream
          }
          if (cache.size >= MAX_CACHE) cache.clear();
          cache.set(key, { at: Date.now(), body: text });
          return new NextResponse(text, {
            headers: {
              "content-type": "application/json",
              "x-rpc-cache": "miss",
            },
          });
        } finally {
          clearTimeout(to);
        }
      } catch (e) {
        failures.push(
          `${host(url)} ${e instanceof Error ? e.message : String(e)}`
        );
        break; // network error/timeout -> next upstream
      }
    }
  }
  return NextResponse.json(
    { error: `upstream unreachable: ${failures.join("; ") || "no upstream"}` },
    { status: 502 }
  );
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** True when a JSON-RPC response body carries an error worth failing over on. */
function isRetryableRpcError(text: string): boolean {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return true; // not JSON at all — don't trust it
  }
  const items = Array.isArray(j) ? j : [j];
  for (const it of items) {
    const err =
      it && typeof it === "object"
        ? (it as { error?: { message?: unknown } }).error
        : undefined;
    if (err) {
      const msg = String(err.message ?? "").toLowerCase();
      // Execution reverts are deterministic — no point failing over.
      if (msg.includes("revert")) return false;
      return true;
    }
  }
  return false;
}

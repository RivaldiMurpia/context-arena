import {
  createPublicClient,
  fallback,
  http,
  type Abi,
  type AbiEvent,
  parseAbiItem,
} from "viem";
import { ARENA_ADDRESS, monadTestnet } from "./chain";
import rawAbi from "./abi.json";

export const ABI = rawAbi as Abi;

/** RPC endpoints in priority order — first responsive one wins.
 * /api/rpc is same-origin (works on any viewer network), the rest are
 * direct fallbacks if the proxy itself is ever down. */
export const RPC_URLS = [
  "/api/rpc",
  "https://monad-testnet.api.onfinality.io/public",
  "https://testnet-rpc.monad.xyz",
];

export const rpcTransport = fallback(
  RPC_URLS.map((url) => http(url, { batch: true })),
  { retryCount: 2, retryDelay: 500 }
);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: rpcTransport,
});

// The public Monad RPC caps at ~15 req/s (it counts requests inside batches
// too). The dashboard fires many parallel reads, so serialize every JSON-RPC
// call with ~90ms spacing to stay comfortably under the limit.
let lastRpcAt = 0;
let rpcQueue: Promise<unknown> = Promise.resolve();
const rawRequest = publicClient.request.bind(publicClient);
publicClient.request = (async (args: unknown, options?: unknown) => {
  const run = rpcQueue.then(async () => {
    const wait = 90 - (Date.now() - lastRpcAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await (rawRequest as (...a: unknown[]) => Promise<unknown>)(
        args,
        options
      );
    } finally {
      lastRpcAt = Date.now();
    }
  });
  rpcQueue = run.catch(() => {});
  return run;
}) as typeof publicClient.request;

const ROUND_CAPITAL = 10n ** 20n; // 100 MON

// ---------- types ----------

export interface RoundInfo {
  id: bigint;
  startTime: bigint;
  endTime: bigint;
  bettingCloseTime: bigint;
  startPrice: bigint;
  endPrice: bigint;
  settled: boolean;
  refundMode: boolean;
  winnerAgentId: bigint;
  betPool: bigint;
  winningBets: bigint;
}

export interface AgentState {
  id: number;
  wallet: `0x${string}`;
  active: boolean;
  cash: bigint;
  holdings: bigint;
  portfolio: bigint;
  pnl: bigint; // portfolio - 100 MON
  betsOn: bigint; // total MON bet on this agent this round
}

export interface PricePoint {
  t: number; // unix seconds
  price: bigint;
}

export type FeedItem =
  | {
      kind: "trade";
      key: string;
      ts: number;
      agentId: number;
      isBuy: boolean;
      amountIn: bigint;
      amountOut: bigint;
      price: bigint;
      tx: `0x${string}`;
      roundId: bigint;
    }
  | {
      kind: "bet";
      key: string;
      ts: number;
      bettor: `0x${string}`;
      agentId: number;
      amount: bigint;
      tx: `0x${string}`;
    }
  | {
      kind: "settle";
      key: string;
      ts: number;
      roundId: bigint;
      winnerAgentId: bigint;
      endPrice: bigint;
      refundMode: boolean;
      tx: `0x${string}`;
    }
  | {
      kind: "round";
      key: string;
      ts: number;
      roundId: bigint;
      startPrice: bigint;
      tx: `0x${string}`;
    };

// ---------- events ----------

const evPrice = parseAbiItem(
  "event PriceUpdated(uint256 indexed roundId, uint256 price)"
);
const evTrade = parseAbiItem(
  "event AgentTrade(uint256 indexed roundId, uint256 indexed agentId, bool isBuy, uint256 amountIn, uint256 amountOut, uint256 price)"
);
const evBet = parseAbiItem(
  "event BetPlaced(uint256 indexed roundId, address indexed bettor, uint256 indexed agentId, uint256 amount)"
);
const evSettle = parseAbiItem(
  "event RoundSettled(uint256 indexed roundId, uint256 indexed winnerAgentId, uint256 endPrice, bool refundMode)"
);
const evRound = parseAbiItem(
  "event RoundStarted(uint256 indexed roundId, uint256 endTime, uint256 startPrice)"
);

type RawLog = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
};

const blockTsCache = new Map<bigint, number>();

async function tsOf(blockNumber: bigint): Promise<number> {
  const hit = blockTsCache.get(blockNumber);
  if (hit !== undefined) return hit;
  const b = await publicClient.getBlock({ blockNumber });
  const ts = Number(b.timestamp);
  blockTsCache.set(blockNumber, ts);
  return ts;
}

/** Chunked getLogs that tolerates RPC range limits. */
async function getLogsChunked(
  event: AbiEvent,
  fromBlock: bigint,
  toBlock: bigint,
  chunk = 8000n
): Promise<RawLog[]> {
  const out: RawLog[] = [];
  let from = fromBlock;
  while (from <= toBlock) {
    const to = from + chunk - 1n > toBlock ? toBlock : from + chunk - 1n;
    try {
      const logs = (await publicClient.getLogs({
        address: ARENA_ADDRESS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event: event as any,
        fromBlock: from,
        toBlock: to,
      })) as unknown as RawLog[];
      out.push(...logs);
    } catch {
      // shrink chunk on failure (rate limits), retry once
      if (chunk > 1000n) {
        const half = await getLogsChunked(event, from, to, chunk / 2n);
        out.push(...half);
      }
    }
    from = to + 1n;
  }
  return out;
}

/**
 * Find the block where a round started, scanning backwards in chunks.
 * Falls back to `fallback` when not found within `maxBack` blocks.
 */
export async function findRoundStartBlock(
  roundId: bigint,
  latest: bigint,
  maxBack = 60000n,
  fallback?: bigint
): Promise<bigint> {
  const chunk = 8000n;
  let to = latest;
  const earliest = latest > maxBack ? latest - maxBack : 0n;
  while (to > earliest) {
    const from = to - chunk + 1n > earliest ? to - chunk + 1n : earliest;
    try {
      const logs = await publicClient.getLogs({
        address: ARENA_ADDRESS,
        event: evRound,
        args: { roundId },
        fromBlock: from,
        toBlock: to,
      });
      if (logs.length > 0) return logs[0].blockNumber;
    } catch {
      /* keep scanning */
    }
    if (from === earliest) break;
    to = from - 1n;
  }
  return fallback ?? (latest > 2000n ? latest - 2000n : 0n);
}

export async function scanEvents(
  fromBlock: bigint,
  toBlock: bigint
): Promise<{ prices: PricePoint[]; feed: FeedItem[] }> {
  const [priceLogs, tradeLogs, betLogs, settleLogs, roundLogs] =
    await Promise.all([
      getLogsChunked(evPrice, fromBlock, toBlock),
      getLogsChunked(evTrade, fromBlock, toBlock),
      getLogsChunked(evBet, fromBlock, toBlock),
      getLogsChunked(evSettle, fromBlock, toBlock),
      getLogsChunked(evRound, fromBlock, toBlock),
    ]);

  const blockNums = new Set<bigint>();
  for (const l of [...priceLogs, ...tradeLogs, ...betLogs, ...settleLogs, ...roundLogs])
    blockNums.add(l.blockNumber);
  await Promise.all([...blockNums].map(tsOf));

  const prices: PricePoint[] = priceLogs.map((l) => ({
    t: blockTsCache.get(l.blockNumber)!,
    price: l.args.price!,
  }));

  const feed: FeedItem[] = [
    ...tradeLogs.map(
      (l): FeedItem => ({
        kind: "trade",
        key: `t-${l.transactionHash}-${l.logIndex}`,
        ts: blockTsCache.get(l.blockNumber)!,
        agentId: Number(l.args.agentId!),
        isBuy: l.args.isBuy!,
        amountIn: l.args.amountIn!,
        amountOut: l.args.amountOut!,
        price: l.args.price!,
        tx: l.transactionHash,
        roundId: l.args.roundId!,
      })
    ),
    ...betLogs.map(
      (l): FeedItem => ({
        kind: "bet",
        key: `b-${l.transactionHash}-${l.logIndex}`,
        ts: blockTsCache.get(l.blockNumber)!,
        bettor: l.args.bettor!,
        agentId: Number(l.args.agentId!),
        amount: l.args.amount!,
        tx: l.transactionHash,
      })
    ),
    ...settleLogs.map(
      (l): FeedItem => ({
        kind: "settle",
        key: `s-${l.transactionHash}-${l.logIndex}`,
        ts: blockTsCache.get(l.blockNumber)!,
        roundId: l.args.roundId!,
        winnerAgentId: l.args.winnerAgentId!,
        endPrice: l.args.endPrice!,
        refundMode: l.args.refundMode!,
        tx: l.transactionHash,
      })
    ),
    ...roundLogs.map(
      (l): FeedItem => ({
        kind: "round",
        key: `r-${l.transactionHash}-${l.logIndex}`,
        ts: blockTsCache.get(l.blockNumber)!,
        roundId: l.args.roundId!,
        startPrice: l.args.startPrice!,
        tx: l.transactionHash,
      })
    ),
  ];
  feed.sort((a, b) => b.ts - a.ts || (b.key > a.key ? 1 : -1));
  prices.sort((a, b) => a.t - b.t);
  return { prices, feed };
}

// ---------- state reads ----------

export async function readRound(rid: bigint): Promise<RoundInfo> {
  const r = (await publicClient.readContract({
    address: ARENA_ADDRESS,
    abi: ABI,
    functionName: "rounds",
    args: [rid],
  })) as unknown as [
    bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean, bigint, bigint, bigint
  ];
  return {
    id: r[0],
    startTime: r[1],
    endTime: r[2],
    bettingCloseTime: r[3],
    startPrice: r[4],
    endPrice: r[5],
    settled: r[6],
    refundMode: r[7],
    winnerAgentId: r[8],
    betPool: r[9],
    winningBets: r[10],
  };
}

export async function readAgent(
  rid: bigint,
  id: number,
  price: bigint
): Promise<AgentState> {
  const [agent, pos, betsOn] = (await Promise.all([
    publicClient.readContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "agents",
      args: [BigInt(id)],
    }),
    publicClient.readContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "positions",
      args: [rid, BigInt(id)],
    }),
    publicClient.readContract({
      address: ARENA_ADDRESS,
      abi: ABI,
      functionName: "betsOn",
      args: [rid, BigInt(id)],
    }),
  ])) as unknown as [
    [string, `0x${string}`, boolean],
    [bigint, bigint],
    bigint
  ];
  const cash = pos[0];
  const holdings = pos[1];
  const portfolio = cash + (holdings * price) / 10n ** 18n;
  return {
    id,
    wallet: agent[1],
    active: agent[2],
    cash,
    holdings,
    portfolio,
    pnl: portfolio - ROUND_CAPITAL,
    betsOn: betsOn,
  };
}

export async function readMyBets(
  rid: bigint,
  bettor: `0x${string}`,
  agentCount: number
): Promise<bigint[]> {
  const out = await Promise.all(
    Array.from({ length: agentCount }, (_, i) =>
      publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: ABI,
        functionName: "betOf",
        args: [rid, bettor, BigInt(i)],
      })
    )
  );
  return out as bigint[];
}

export async function readClaimed(
  rid: bigint,
  bettor: `0x${string}`
): Promise<boolean> {
  return (await publicClient.readContract({
    address: ARENA_ADDRESS,
    abi: ABI,
    functionName: "claimed",
    args: [rid, bettor],
  })) as boolean;
}

export async function readBasics(): Promise<{
  roundCount: bigint;
  hasActive: boolean;
  price: bigint;
  agentCount: bigint;
  blockNumber: bigint;
}> {
  const [roundCount, hasActive, price, agentCount, blockNumber] =
    await Promise.all([
      publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: ABI,
        functionName: "roundCount",
      }),
      publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: ABI,
        functionName: "activeRound",
      }),
      publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: ABI,
        functionName: "currentPrice",
      }),
      publicClient.readContract({
        address: ARENA_ADDRESS,
        abi: ABI,
        functionName: "agentCount",
      }),
      publicClient.getBlockNumber(),
    ]);
  return {
    roundCount: roundCount as bigint,
    hasActive: hasActive as boolean,
    price: price as bigint,
    agentCount: agentCount as bigint,
    blockNumber: blockNumber as bigint,
  };
}

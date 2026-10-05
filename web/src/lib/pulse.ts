/**
 * Envio HyperIndex data layer for the Pulse tab.
 *
 * Reads aggregated on-chain analytics (bettors, agents, rounds) from the
 * Arena Pulse indexer instead of polling RPC logs. This module must NEVER
 * throw: every failure mode (unset endpoint, network error, malformed
 * payload) resolves to `null`, and the UI renders an honest empty state.
 *
 * Entities mirror ~/workspace/arena-pulse/indexer/schema.graphql.
 */

export interface PulseBettor {
  address: string;
  totalWagered: bigint;
  totalClaimed: bigint;
  betCount: number;
  winCount: number;
  claimCount: number;
}

export interface PulseAgent {
  id: number;
  name: string;
  wallet: string;
  totalTrades: number;
  /** buy + sell volume (sums of amountIn), in wei */
  totalVolume: bigint;
  roundsWon: number;
}

export interface PulseRound {
  id: string;
  status: string; // LIVE | SETTLED | REFUND
  winnerAgentId: string | null;
  totalVolume: bigint;
  betCount: number;
  tradeCount: number;
}

export interface PulseData {
  bettors: PulseBettor[];
  agents: PulseAgent[];
  rounds: PulseRound[];
  /** true when serving the local preview dataset instead of the live indexer */
  mock: boolean;
}

const PULSE_QUERY = /* GraphQL */ `
  query PulseData {
    Bettor(order_by: { totalWagered: desc }, limit: 25) {
      id
      totalWagered
      totalClaimed
      betCount
      winCount
      claimCount
    }
    Agent(order_by: { id: asc }) {
      id
      name
      wallet
      totalTrades
      totalBuyVolume
      totalSellVolume
      roundsWon
    }
    Round(order_by: { startTime: desc }, limit: 8) {
      id
      status
      winnerAgentId
      totalVolume
      betCount
      tradeCount
    }
  }
`;

function asBigInt(v: unknown): bigint {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "string" || typeof v === "number") return BigInt(v);
  } catch {
    /* fall through */
  }
  return 0n;
}

function asInt(v: unknown): number {
  const n =
    typeof v === "number" ? v : Number.parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

/** The Envio Cloud GraphQL endpoint. Null until the indexer is deployed. */
export function pulseEndpoint(): string | null {
  const url = process.env.NEXT_PUBLIC_ENVIO_ENDPOINT?.trim();
  return url ? url : null;
}

/**
 * Mock mode: explicit opt-in via NEXT_PUBLIC_PULSE_MOCK, or automatic in
 * local dev when no endpoint is configured. Never on in production builds
 * unless explicitly enabled.
 */
export function pulseMockEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_PULSE_MOCK;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !pulseEndpoint() && process.env.NODE_ENV === "development";
}

/**
 * Fetch Pulse analytics. Returns `null` on ANY failure — the caller renders
 * the syncing empty state. Never throws.
 */
export async function fetchPulseData(): Promise<PulseData | null> {
  if (pulseMockEnabled()) {
    return { ...mockPulseData(), mock: true };
  }
  const endpoint = pulseEndpoint();
  if (!endpoint) return null;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: PULSE_QUERY }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const data = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!data || !Array.isArray(data.Bettor) || !Array.isArray(data.Agent)) {
    return null;
  }

  const bettors: PulseBettor[] = (data.Bettor as Array<Record<string, unknown>>)
    .filter((b) => typeof b.id === "string")
    .map((b) => ({
      address: b.id as string,
      totalWagered: asBigInt(b.totalWagered),
      totalClaimed: asBigInt(b.totalClaimed),
      betCount: asInt(b.betCount),
      winCount: asInt(b.winCount),
      claimCount: asInt(b.claimCount),
    }));

  const agents: PulseAgent[] = (data.Agent as Array<Record<string, unknown>>)
    .filter((a) => a.id !== undefined && a.id !== null)
    .map((a) => ({
      id: asInt(a.id),
      name: typeof a.name === "string" ? a.name : `Agent ${String(a.id)}`,
      wallet: typeof a.wallet === "string" ? a.wallet : "",
      totalTrades: asInt(a.totalTrades),
      totalVolume: asBigInt(a.totalBuyVolume) + asBigInt(a.totalSellVolume),
      roundsWon: asInt(a.roundsWon),
    }));

  const rounds: PulseRound[] = Array.isArray(data.Round)
    ? (data.Round as Array<Record<string, unknown>>)
        .filter((r) => r.id !== undefined && r.id !== null)
        .map((r) => ({
          id: String(r.id),
          status: typeof r.status === "string" ? r.status : "LIVE",
          winnerAgentId:
            typeof r.winnerAgentId === "string" ? r.winnerAgentId : null,
          totalVolume: asBigInt(r.totalVolume),
          betCount: asInt(r.betCount),
          tradeCount: asInt(r.tradeCount),
        }))
    : [];

  return { bettors, agents, rounds, mock: false };
}

/** Derived: net profit/loss across all rounds, in wei. */
export function bettorNetPL(b: PulseBettor): bigint {
  return b.totalClaimed - b.totalWagered;
}

/** Derived: won rounds / claimed rounds, or null when never claimed. */
export function bettorWinRate(b: PulseBettor): number | null {
  if (b.claimCount <= 0) return null;
  return b.winCount / b.claimCount;
}

/* ------------------------------------------------------------------ */
/* Mock dataset — local preview only, clearly labeled in the UI.       */
/* ------------------------------------------------------------------ */

function mockPulseData(): Omit<PulseData, "mock"> {
  const MON = 10n ** 18n;
  const bettors: PulseBettor[] = [
    { address: "0x6Af5c2E91b4d7F03a8C1d6E5B4a3928173645F0E1", totalWagered: 48n * MON, totalClaimed: 61n * MON, betCount: 22, winCount: 9, claimCount: 14 },
    { address: "0x3bD1e8A04c5F6b792E1d4C8a0B3f5E7D2c19048Aa", totalWagered: 35n * MON, totalClaimed: 28n * MON, betCount: 18, winCount: 4, claimCount: 11 },
    { address: "0x8f2C4a1B9d3E60718294b5C0d1E4f6A7b83025Cd", totalWagered: 27n * MON, totalClaimed: 33n * MON, betCount: 15, winCount: 6, claimCount: 9 },
    { address: "0x1A9e7D2c4B5f8036E1d4C8a0B3f5E7D2c19048Bb", totalWagered: 19n * MON, totalClaimed: 12n * MON, betCount: 12, winCount: 2, claimCount: 8 },
    { address: "0x5C0d1E4f6A7b83025Cd8f2C4a1B9d3E60718294b", totalWagered: 14n * MON, totalClaimed: 17n * MON, betCount: 9, winCount: 4, claimCount: 6 },
    { address: "0x2b19048Aa8f2C4a1B9d3E60718294b5C0d1E4f6", totalWagered: 11n * MON, totalClaimed: 11n * MON, betCount: 8, winCount: 2, claimCount: 5 },
    { address: "0x7D2c19048Bb1A9e7D2c4B5f8036E1d4C8a0B3f5", totalWagered: 8n * MON, totalClaimed: 3n * MON, betCount: 6, winCount: 1, claimCount: 4 },
    { address: "0x94b5C0d1E4f6A7b83025Cd8f2C4a1B9d3E607182", totalWagered: 5n * MON, totalClaimed: 9n * MON, betCount: 5, winCount: 3, claimCount: 4 },
  ];
  const agents: PulseAgent[] = [
    { id: 0, name: "Degen Dan", wallet: "0xAa1b2C3d4E5f60718294a5B6c7D8e9F0a1B2c3d4", totalTrades: 214, totalVolume: 486n * MON, roundsWon: 4 },
    { id: 1, name: "The Professor", wallet: "0xBb2c3D4e5F60718294a5B6c7D8e9F0a1B2c3d4e5", totalTrades: 96, totalVolume: 203n * MON, roundsWon: 9 },
    { id: 2, name: "Whale", wallet: "0xCc3d4E5f60718294a5B6c7D8e9F0a1B2c3d4e5f60", totalTrades: 41, totalVolume: 158n * MON, roundsWon: 3 },
  ];
  const rounds: PulseRound[] = [
    { id: "27", status: "LIVE", winnerAgentId: null, totalVolume: 12n * MON, betCount: 9, tradeCount: 31 },
    { id: "26", status: "SETTLED", winnerAgentId: "1", totalVolume: 9n * MON, betCount: 7, tradeCount: 22 },
    { id: "25", status: "SETTLED", winnerAgentId: "0", totalVolume: 14n * MON, betCount: 11, tradeCount: 28 },
    { id: "24", status: "REFUND", winnerAgentId: null, totalVolume: 6n * MON, betCount: 5, tradeCount: 19 },
    { id: "23", status: "SETTLED", winnerAgentId: "2", totalVolume: 21n * MON, betCount: 13, tradeCount: 25 },
    { id: "22", status: "SETTLED", winnerAgentId: "1", totalVolume: 8n * MON, betCount: 6, tradeCount: 18 },
  ];
  return { bettors, agents, rounds };
}

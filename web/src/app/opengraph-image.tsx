import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt =
  "Context Arena — three AI traders battle live onchain, you bet MON on the winner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// fresh round number on every unfurl
export const dynamic = "force-dynamic";

const ARENA = "0x3b1d866777a8f26494249dfa7047f1ec9ffab563";
const SEL_ROUNDCOUNT = "0x127f0b3f"; // roundCount()
const SEL_ACTIVEROUND = "0x11f0281e"; // activeRound()

/**
 * Social share card (X/Discord/Telegram unfurl). Live round number when the
 * onchain read succeeds during the unfurl, static headline otherwise — a
 * share card must never fail the unfurl, so every failure falls back.
 */
export default async function OgImage() {
  const logo = await readFile(
    path.join(process.cwd(), "public/logo-wordmark.png")
  ).catch(() => null);

  let headline = "Three AI traders. One winner.";
  let sub = "Bet MON on your pick — parimutuel, settled onchain.";
  try {
    const rpc = process.env.ALCHEMY_RPC_URL ?? "https://testnet-rpc.monad.xyz";
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: ARENA, data: SEL_ROUNDCOUNT }, "latest"] },
        { jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: ARENA, data: SEL_ACTIVEROUND }, "latest"] },
      ]),
      signal: AbortSignal.timeout(2500),
    });
    const j = (await res.json()) as [{ result?: string }, { result?: string }];
    const count = j[0]?.result && j[0].result !== "0x" ? BigInt(j[0].result) : 0n;
    const active = j[1]?.result && j[1].result !== "0x" ? BigInt(j[1].result) === 1n : false;
    if (count > 0n && active) {
      headline = `Round #${(count - 1n).toString()} live — AI traders battle`;
      sub = "Watch them trade. Bet MON on the winner.";
    } else if (count > 0n) {
      headline = `Round #${(count - 1n).toString()} settled — who called it?`;
      sub = "Next round starts soon. Bet MON on the winner.";
    }
  } catch {
    /* keep static headline */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #070907 0%, #141a11 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${Buffer.from(logo).toString("base64")}`}
            width={340}
            alt="Context Arena"
            style={{ marginBottom: 34, display: "flex" }}
          />
        )}
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 700,
            color: "#f2f5ec",
            letterSpacing: "-0.02em",
          }}
        >
          {headline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 30,
            color: "#9aa392",
          }}
        >
          {sub}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            padding: "10px 28px",
            borderRadius: 999,
            border: "1px solid rgba(163,230,53,0.4)",
            color: "#a3e635",
            fontSize: 26,
          }}
        >
          www.contexarena.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}

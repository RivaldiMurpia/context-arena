import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import {
  isValidUsername,
  linkMessage,
  supabaseServer,
} from "@/lib/supabase";

const SIGNATURE_TTL_S = 300; // signed message must be fresh (5 min)

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * GET /api/profile?wallet=0x...
 * Public read of a wallet's profile (or null when never set).
 */
export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get("wallet") ?? "").toLowerCase();
  if (!isAddress(wallet)) return json({ error: "bad wallet" }, 400);
  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return json({ error: "profiles unavailable" }, 503);
  }
  const { data, error } = await sb
    .from("profiles")
    .select("wallet, username, created_at, updated_at")
    .eq("wallet", wallet)
    .maybeSingle();
  if (error) return json({ error: "db error" }, 500);
  return json({ profile: data ?? null });
}

interface LinkBody {
  wallet?: unknown;
  username?: unknown;
  timestamp?: unknown;
  signature?: unknown;
}

/**
 * POST /api/profile  { wallet, username, timestamp, signature }
 * Links (or changes) the username for a wallet. The wallet must have signed
 * linkMessage(username, wallet, timestamp); the signature is verified
 * server-side and the timestamp must be within SIGNATURE_TTL_S.
 */
export async function POST(req: NextRequest) {
  let body: LinkBody;
  try {
    body = (await req.json()) as LinkBody;
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const wallet =
    typeof body.wallet === "string" ? body.wallet.toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const timestamp =
    typeof body.timestamp === "number" ? Math.floor(body.timestamp) : NaN;
  const signature =
    typeof body.signature === "string" ? body.signature : "";

  if (!isAddress(wallet)) return json({ error: "bad wallet" }, 400);
  if (!isValidUsername(username))
    return json(
      { error: "username must be 3–20 chars: letters, numbers, underscore" },
      400
    );
  if (!Number.isFinite(timestamp)) return json({ error: "bad timestamp" }, 400);
  const ageS = Math.floor(Date.now() / 1000) - timestamp;
  if (ageS < 0 || ageS > SIGNATURE_TTL_S)
    return json({ error: "signature expired — sign again" }, 400);
  if (!/^0x[0-9a-fA-F]+$/.test(signature))
    return json({ error: "bad signature" }, 400);

  // Rebuild the exact message we expect; the signature must match it.
  const message = linkMessage(
    username,
    wallet as `0x${string}`,
    timestamp
  );
  let ok = false;
  try {
    ok = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    ok = false;
  }
  if (!ok) return json({ error: "signature verification failed" }, 401);

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return json({ error: "profiles unavailable" }, 503);
  }

  const { data, error } = await sb
    .from("profiles")
    .upsert({ wallet, username }, { onConflict: "wallet" })
    .select("wallet, username, created_at, updated_at")
    .single();

  if (error) {
    // unique violation on username_lower -> name taken
    if (error.code === "23505")
      return json({ error: "username is taken" }, 409);
    return json({ error: "db error" }, 500);
  }
  return json({ profile: data });
}

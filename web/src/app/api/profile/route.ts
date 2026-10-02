import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import {
  BIO_MAX,
  MAX_USERNAME_CHANGES,
  isValidUsername,
  linkMessage,
  normalizeBio,
  supabaseServer,
} from "@/lib/supabase";

const SIGNATURE_TTL_S = 300; // signed message must be fresh (5 min)

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

const PROFILE_COLS = "wallet, username, bio, username_changes, created_at, updated_at";

/**
 * GET /api/profile?wallet=0x...
 * Public read of a wallet's profile (or null when never claimed).
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
    .select(PROFILE_COLS)
    .eq("wallet", wallet)
    .maybeSingle();
  if (error) return json({ error: "db error" }, 500);
  return json({ profile: data ?? null });
}

interface LinkBody {
  wallet?: unknown;
  username?: unknown;
  bio?: unknown;
  timestamp?: unknown;
  signature?: unknown;
}

/**
 * POST /api/profile  { wallet, username, bio?, timestamp, signature }
 *
 * Creates the profile (first claim) or updates it. The wallet must have
 * signed linkMessage(username, wallet, timestamp, bio); the signature is
 * verified server-side and the timestamp must be within SIGNATURE_TTL_S.
 *
 * Username policy: the name is auto-generated on first claim and can be
 * changed exactly once afterwards (username_changes caps at 1). Bio edits
 * are unlimited and never consume the rename.
 */
export async function POST(req: NextRequest) {
  let body: LinkBody;
  try {
    body = (await req.json()) as LinkBody;
  } catch {
    return json({ error: "bad json" }, 400);
  }

  // The address exactly as sent: the client signs with this same casing
  // (wagmi gives checksummed addresses), so the server must rebuild the
  // message byte-identical. Only the DB key is lowercased.
  const rawWallet = typeof body.wallet === "string" ? body.wallet : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const bio =
    body.bio === undefined
      ? undefined
      : normalizeBio(typeof body.bio === "string" ? body.bio : "");
  const timestamp =
    typeof body.timestamp === "number" ? Math.floor(body.timestamp) : NaN;
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!isAddress(rawWallet)) return json({ error: "bad wallet" }, 400);
  if (!isValidUsername(username))
    return json(
      { error: "username must be 3–20 chars: letters, numbers, underscore" },
      400
    );
  if (bio !== undefined && bio.length > BIO_MAX)
    return json({ error: `bio must be ${BIO_MAX} characters or less` }, 400);
  if (!Number.isFinite(timestamp)) return json({ error: "bad timestamp" }, 400);
  const ageS = Math.floor(Date.now() / 1000) - timestamp;
  if (ageS < 0 || ageS > SIGNATURE_TTL_S)
    return json({ error: "signature expired — sign again" }, 400);
  if (!/^0x[0-9a-fA-F]+$/.test(signature))
    return json({ error: "bad signature" }, 400);

  const message = linkMessage(
    username,
    rawWallet as `0x${string}`,
    timestamp,
    bio
  );
  let ok = false;
  try {
    ok = await verifyMessage({
      address: rawWallet as `0x${string}`,
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

  const wallet = rawWallet.toLowerCase();
  const { data: existing } = await sb
    .from("profiles")
    .select("username, bio, username_changes")
    .eq("wallet", wallet)
    .maybeSingle();

  const renaming =
    !!existing &&
    existing.username.toLowerCase() !== username.toLowerCase();
  if (renaming && existing.username_changes >= MAX_USERNAME_CHANGES) {
    return json(
      { error: "username can only be changed once — it is now locked" },
      403
    );
  }

  let data, error;
  if (existing) {
    ({ data, error } = await sb
      .from("profiles")
      .update({
        username,
        bio: bio ?? existing.bio,
        username_changes: existing.username_changes + (renaming ? 1 : 0),
      })
      .eq("wallet", wallet)
      .select(PROFILE_COLS)
      .single());
  } else {
    ({ data, error } = await sb
      .from("profiles")
      .insert({ wallet, username, bio: bio ?? "", username_changes: 0 })
      .select(PROFILE_COLS)
      .single());
  }

  if (error) {
    // unique violation on username_lower -> name taken
    if (error.code === "23505")
      return json({ error: "username is taken" }, 409);
    return json({ error: "db error" }, 500);
  }
  return json({ profile: data });
}

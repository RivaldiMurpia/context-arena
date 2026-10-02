import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { keccak256, stringToBytes } from "viem";

/**
 * Supabase clients for wallet identity (profiles).
 *
 * Reads are public (RLS allows SELECT to anyone). Writes go through the
 * service-role client, which lives ONLY in server code (API routes) and is
 * gated behind wallet-signature verification — never expose the service key
 * to the browser.
 *
 * Required env vars (set them in Vercel too):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (server only)
 */

let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing)"
    );
  }
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

export function supabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured (SUPABASE_SERVICE_ROLE_KEY missing)"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface Profile {
  wallet: string; // lowercase 0x address
  username: string;
  bio: string;
  /** renames used so far — the API caps this at 1 */
  username_changes: number;
  created_at: string;
  updated_at: string;
}

/** Wallets get exactly one username change, ever. */
export const MAX_USERNAME_CHANGES = 1;

export function usernameChangesLeft(p: Profile | null): number {
  if (!p) return MAX_USERNAME_CHANGES;
  return Math.max(0, MAX_USERNAME_CHANGES - p.username_changes);
}

export function isValidUsername(name: string): boolean {
  return /^[A-Za-z0-9_]{3,20}$/.test(name);
}

export const BIO_MAX = 160;

/** Single-line, trimmed bio. */
export function normalizeBio(bio: string): string {
  return bio
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BIO_MAX);
}

/**
 * Deterministic auto-generated username for first-time users:
 * user_ + 8 hex chars from the wallet hash. Stable per wallet, so the
 * claim modal can show it before anything is signed.
 */
export function generatedUsername(wallet: string): string {
  const hash = keccak256(stringToBytes(wallet.toLowerCase()));
  return `user_${hash.slice(2, 10)}`;
}

/**
 * The exact message the wallet must sign to create/update a profile.
 * The API route reconstructs this itself and rejects anything else,
 * so a signature can't be replayed for different data.
 */
export function linkMessage(
  username: string,
  wallet: `0x${string}`,
  timestamp: number,
  bio?: string
): string {
  let m =
    "Sign this message to link your Context Arena username.\n\n" +
    `Username: ${username}\n` +
    `Wallet: ${wallet}\n` +
    `Timestamp: ${timestamp}`;
  if (bio !== undefined) m += `\nBio: ${bio}`;
  return m;
}

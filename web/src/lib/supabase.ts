import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  created_at: string;
  updated_at: string;
}

export function isValidUsername(name: string): boolean {
  return /^[A-Za-z0-9_]{3,20}$/.test(name);
}

/**
 * The exact message the wallet must sign to link/change a username.
 * The API route reconstructs this itself and rejects anything else,
 * so a signature can't be replayed for a different username/wallet.
 */
export function linkMessage(
  username: string,
  wallet: `0x${string}`,
  timestamp: number
): string {
  return (
    "Sign this message to link your Context Arena username.\n\n" +
    `Username: ${username}\n` +
    `Wallet: ${wallet}\n` +
    `Timestamp: ${timestamp}`
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  generatedUsername,
  isValidUsername,
  linkMessage,
  normalizeBio,
  usernameChangesLeft,
  type Profile,
} from "@/lib/supabase";

export interface SaveProfileInput {
  username: string;
  bio?: string;
}

export function useProfile() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;
    let dead = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/profile?wallet=${address}`);
        if (r.status === 503) {
          if (!dead) setUnavailable(true);
          return;
        }
        const j = await r.json();
        if (!dead) setProfile(j.profile ?? null);
      } catch {
        if (!dead) setError("Could not load profile.");
      } finally {
        if (!dead) setLoading(false);
      }
    };
    run();
    return () => {
      dead = true;
    };
  }, [address, isConnected]);

  /**
   * Create (first claim) or update the profile. Signs
   * linkMessage(username, wallet, timestamp, bio) — free, no gas.
   * Throws with a human-readable message on failure.
   */
  const saveProfile = useCallback(
    async ({ username, bio }: SaveProfileInput): Promise<Profile> => {
      if (!address) throw new Error("Connect your wallet first.");
      const name = username.trim();
      if (!isValidUsername(name))
        throw new Error(
          "Username must be 3–20 characters: letters, numbers, underscore."
        );
      const cleanBio =
        bio === undefined ? undefined : normalizeBio(bio);
      setSaving(true);
      setError(null);
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = linkMessage(name, address, timestamp, cleanBio);
        const signature = await signMessageAsync({ message });
        const r = await fetch("/api/profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallet: address,
            username: name,
            bio: cleanBio,
            timestamp,
            signature,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not save profile.");
        setProfile(j.profile as Profile);
        return j.profile as Profile;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not save profile.";
        setError(
          /rejected|denied|cancelled/i.test(msg) ? "Signature rejected." : msg
        );
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        setSaving(false);
      }
    },
    [address, signMessageAsync]
  );

  const generatedName = useMemo(
    () => (address ? generatedUsername(address) : null),
    [address]
  );

  return {
    profile,
    loading,
    saving,
    error,
    unavailable,
    saveProfile,
    /** renames remaining (1 total, 0 once used) */
    changesLeft: usernameChangesLeft(profile),
    /** deterministic user_xxxxxxxx suggestion for first claim */
    generatedName,
  };
}

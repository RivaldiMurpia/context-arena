"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  Check,
  Copy,
  Lock,
  PencilSimple,
  ShareNetwork,
  User,
  X,
} from "@phosphor-icons/react";
import { fmtMon } from "@/lib/chain";
import { BIO_MAX, normalizeBio } from "@/lib/supabase";
import { useMyBids } from "@/hooks/useMyBids";
import { useProfile } from "@/hooks/useProfile";
import { useWalletUI } from "@/components/WalletUI";
import { ProfileModal } from "@/components/ProfileButton";
import { WalletAvatar } from "@/components/WalletAvatar";
import { MyBidTable } from "@/components/MyBidTable";

function useBetStats() {
  const { bids, loading } = useMyBids();
  const stats = useMemo(() => {
    const settled = bids.filter((b) => b.status !== "pending");
    const wins = settled.filter((b) => b.status === "won");
    const wagered = bids.reduce((a, b) => a + b.amount, 0n);
    const wonTotal = wins.reduce((a, b) => a + (b.payout ?? 0n), 0n);
    const net = settled.reduce(
      (a, b) =>
        a +
        (b.status === "won" && b.payout !== null
          ? b.payout - b.amount
          : b.status === "refund"
            ? 0n
            : -b.amount),
      0n
    );
    const best = wins.reduce(
      (m, b) =>
        b.payout !== null && b.payout - b.amount > m ? b.payout - b.amount : m,
      0n
    );
    return {
      totalBets: bids.length,
      wins: wins.length,
      settled: settled.length,
      winRate: settled.length ? wins.length / settled.length : null,
      wagered,
      wonTotal,
      net,
      best,
      avg: bids.length ? wagered / BigInt(bids.length) : 0n,
    };
  }, [bids]);
  return { bids, loading, stats };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border hairline bg-panel p-4">
      <p className="text-[12px] text-faint">{label}</p>
      <p className="tnum mt-1.5 text-[19px] font-semibold tracking-tight text-bone">
        {value}
        {sub && (
          <span className="ml-1.5 text-[12px] font-normal text-faint">{sub}</span>
        )}
      </p>
    </div>
  );
}

function BioModal({ onClose }: { onClose: () => void }) {
  const { profile, saveProfile, saving, error } = useProfile();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    const clean = normalizeBio(bio);
    if (clean.length > BIO_MAX) {
      setLocalError(`Max ${BIO_MAX} characters.`);
      return;
    }
    try {
      await saveProfile({ username: profile!.username, bio: clean });
      onClose();
    } catch {
      /* surfaced by hook */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit biography"
    >
      <div
        className="w-full max-w-[400px] rounded-2xl border hairline bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[17px] font-bold tracking-tight">
            Edit biography
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ash transition-colors hover:text-bone"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={BIO_MAX + 20}
          placeholder="Tell the arena who you are…"
          autoFocus
          className="mt-4 w-full resize-none rounded-xl border hairline bg-void px-4 py-3 text-[14px] text-bone outline-none placeholder:text-faint focus:border-acid/60"
        />
        <p className="tnum mt-1 text-right text-[11px] text-faint">
          {normalizeBio(bio).length}/{BIO_MAX}
        </p>
        {(localError || error) && (
          <p className="mt-2 text-[12px] text-red-400">{localError ?? error}</p>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-acid text-[14px] font-semibold text-void transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Waiting for signature…" : "Sign & save"}
        </button>
      </div>
    </div>
  );
}

function CopyId({ wallet }: { wallet: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(wallet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="tnum inline-flex items-center gap-1.5 text-[13px] text-faint transition-colors hover:text-bone"
      title={wallet}
    >
      ID: {wallet.slice(0, 4)}…{wallet.slice(-4)}
      {copied ? <Check size={13} className="text-acid" /> : <Copy size={13} />}
    </button>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { openWallet } = useWalletUI();
  const { profile, loading, unavailable, changesLeft, generatedName } =
    useProfile();
  const { bids, loading: bidsLoading, stats } = useBetStats();
  const [modal, setModal] = useState<"claim" | "rename" | "bio" | null>(null);
  const [shared, setShared] = useState(false);

  if (!isConnected) {
    return (
      <div className="pt-8 pb-16">
        <div className="flex flex-col items-start gap-4 rounded-2xl border hairline bg-panel p-6 sm:p-8">
          <User size={28} className="text-acid" />
          <div>
            <p className="font-display text-[16px] font-semibold tracking-tight">
              Connect your wallet to see your profile
            </p>
            <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-ash">
              Claim your username, track your betting stats, and build your
              arena identity.
            </p>
          </div>
          <button
            onClick={openWallet}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-acid px-6 text-[14px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const joined = profile
    ? new Date(profile.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/profile`
      );
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="pt-8 pb-16">
      {/* Banner + identity header */}
      <div className="overflow-hidden rounded-3xl border hairline">
        <div
          className="relative h-[150px] sm:h-[180px]"
          style={{
            background:
              "radial-gradient(120% 160% at 50% 120%, rgba(163,230,53,0.14) 0%, rgba(120,40,80,0.25) 45%, #0a0a0c 78%)",
          }}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            {profile && changesLeft > 0 && (
              <button
                onClick={() => setModal("rename")}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium text-bone backdrop-blur transition hover:bg-white/[0.12]"
              >
                <PencilSimple size={14} />
                Edit
              </button>
            )}
            <button
              onClick={share}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium text-bone backdrop-blur transition hover:bg-white/[0.12]"
            >
              {shared ? <Check size={14} className="text-acid" /> : <ShareNetwork size={14} />}
              {shared ? "Copied" : "Share"}
            </button>
          </div>
        </div>
        <div className="bg-panel px-5 pb-5 sm:px-7">
          <div className="-mt-10 mb-3">
            {address && (
              <WalletAvatar
                wallet={address}
                size={80}
                className="ring-4 ring-panel"
              />
            )}
          </div>
          {loading ? (
            <div className="skeleton h-7 w-48 rounded-lg bg-white/[0.06]" />
          ) : profile ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[24px] font-extrabold tracking-tight">
                  {profile.username}
                </h1>
                {changesLeft === 0 && (
                  <span
                    className="tnum inline-flex items-center gap-1 rounded-full border hairline px-2.5 py-1 text-[10px] text-faint"
                    title="Your one username change has been used"
                  >
                    <Lock size={11} />
                    LOCKED
                  </span>
                )}
              </div>
              <div className="tnum mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-faint">
                {joined && <span>Joined {joined}</span>}
                <span aria-hidden>·</span>
                <CopyId wallet={profile.wallet} />
              </div>
            </>
          ) : (
            !unavailable && (
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="font-display text-[20px] font-extrabold tracking-tight">
                    Claim your username
                  </p>
                  <p className="tnum mt-1 text-[13px] text-faint">
                    {generatedName} · auto-generated for your wallet
                  </p>
                </div>
                <button
                  onClick={() => setModal("claim")}
                  className="ml-auto inline-flex h-10 items-center rounded-full bg-acid px-5 text-[13px] font-semibold text-void transition hover:brightness-110 active:scale-[0.98]"
                >
                  Claim it
                </button>
              </div>
            )
          )}

          {/* Headline stats */}
          {profile && (
            <div className="tnum mt-5 flex gap-8">
              <div>
                <p className="text-[11px] tracking-[0.14em] text-faint">WAGERED</p>
                <p className="mt-1 text-[15px] font-semibold text-acid">
                  {fmtMon(stats.wagered, 2)}
                </p>
              </div>
              <div>
                <p className="text-[11px] tracking-[0.14em] text-faint">WIN RATE</p>
                <p className="mt-1 text-[15px] font-semibold text-acid">
                  {stats.winRate === null
                    ? "N/A"
                    : `${(stats.winRate * 100).toFixed(0)}%`}
                </p>
              </div>
              <div>
                <p className="text-[11px] tracking-[0.14em] text-faint">NET P/L</p>
                <p
                  className={`mt-1 text-[15px] font-semibold ${stats.net >= 0n ? "text-acid" : "text-red-400"}`}
                >
                  {stats.net >= 0n ? "+" : "−"}
                  {fmtMon(stats.net >= 0n ? stats.net : -stats.net, 2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {profile && (
        <>
          {/* Biography */}
          <section className="mt-6" aria-label="Biography">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold tracking-tight">
                Biography
              </h2>
              <button
                onClick={() => setModal("bio")}
                className="inline-flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-bone"
              >
                <PencilSimple size={13} />
                Edit
              </button>
            </div>
            <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-ash">
              {profile.bio || "Description not added…"}
            </p>
          </section>

          {/* Statistics */}
          <section className="mt-8" aria-label="Statistics">
            <h2 className="font-display text-[20px] font-bold tracking-tight">
              Statistics
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total Bets" value={String(stats.totalBets)} />
              <StatCard label="Wins" value={String(stats.wins)} />
              <StatCard
                label="Win Rate"
                value={
                  stats.winRate === null
                    ? "N/A"
                    : `${(stats.winRate * 100).toFixed(1)}%`
                }
              />
              <StatCard
                label="Total Wagered"
                value={fmtMon(stats.wagered, 2)}
                sub="MON"
              />
              <StatCard
                label="Total Won"
                value={fmtMon(stats.wonTotal, 2)}
                sub="MON"
              />
              <StatCard
                label="Net P/L"
                value={`${stats.net >= 0n ? "+" : "−"}${fmtMon(stats.net >= 0n ? stats.net : -stats.net, 2)}`}
                sub="MON"
              />
              <StatCard
                label="Best Win"
                value={stats.best > 0n ? `+${fmtMon(stats.best, 2)}` : "—"}
                sub={stats.best > 0n ? "MON" : undefined}
              />
              <StatCard
                label="Avg Bet"
                value={fmtMon(stats.avg, 2)}
                sub="MON"
              />
            </div>
          </section>

          {/* Recent bids */}
          <section className="mt-8" aria-label="My bids">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-bold tracking-tight">
                My Bids
                <span className="tnum ml-2 rounded-full bg-white/[0.07] px-2 py-0.5 align-middle text-[12px] font-medium text-faint">
                  {stats.totalBets}
                </span>
              </h2>
              <Link
                href="/history"
                className="text-[13px] text-acid transition hover:brightness-110"
              >
                View all →
              </Link>
            </div>
            <div className="mt-3">
              <MyBidTable bids={bids} loading={bidsLoading} limit={8} />
            </div>
          </section>
        </>
      )}

      {modal === "bio" ? (
        <BioModal onClose={() => setModal(null)} />
      ) : (
        modal && <ProfileModal mode={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

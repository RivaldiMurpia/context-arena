"use client";

import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { PencilSimple, SignOut, User, Wallet, X } from "@phosphor-icons/react";
import { shortAddr } from "@/lib/chain";
import { isValidUsername } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { useWalletUI } from "@/components/WalletUI";

export function UsernameModal({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { profile, linkUsername, saving, error } = useProfile();
  const [name, setName] = useState(profile?.username ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    if (!isValidUsername(name.trim())) {
      setLocalError(
        "3–20 characters: letters, numbers, underscore."
      );
      return;
    }
    try {
      await linkUsername(name);
      onClose();
    } catch {
      /* error is surfaced by the hook */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set username"
    >
      <div
        className="w-full max-w-[400px] rounded-2xl border hairline bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[17px] font-bold tracking-tight">
            {profile ? "Change username" : "Pick a username"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ash transition-colors hover:text-bone"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ash">
          Your wallet stays in your control — you just sign a message to prove
          it&apos;s yours. No gas, no transaction.
        </p>
        <label className="mt-4 block">
          <span className="tnum text-[10px] tracking-[0.18em] text-faint">
            USERNAME
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. degen_king"
            maxLength={20}
            autoFocus
            className="mt-1.5 h-11 w-full rounded-xl border hairline bg-void px-4 text-[14px] text-bone outline-none placeholder:text-faint focus:border-acid/60"
          />
        </label>
        {(localError || error) && (
          <p className="mt-2 text-[12px] text-red-400">{localError ?? error}</p>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-acid text-[14px] font-semibold text-void transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          <PencilSimple size={16} weight="bold" />
          {saving ? "Waiting for signature…" : "Sign & save"}
        </button>
        <p className="tnum mt-3 text-center text-[11px] text-faint">
          {address ? shortAddr(address) : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * Identity-aware replacement for the plain connect button: shows the
 * linked username when one exists, otherwise the short address, with a
 * one-tap way to set/change the name and to disconnect.
 */
export function ProfileButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openWallet } = useWalletUI();
  const { profile, loading, unavailable } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isConnected) {
    return (
      <button
        onClick={openWallet}
        className="flex h-10 items-center gap-2 rounded-full bg-acid px-5 text-[13px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
      >
        <Wallet size={15} weight="bold" />
        Connect Wallet
      </button>
    );
  }

  return (
    <>
      <div className="flex h-10 items-center gap-1 rounded-full bg-elev py-1 pr-1 pl-4">
        <User size={14} className="shrink-0 text-acid" />
        {loading ? (
          <span className="skeleton h-4 w-16 rounded-md bg-white/[0.08]" />
        ) : (
          <button
            onClick={() => !unavailable && setModalOpen(true)}
            title={
              unavailable
                ? "Profiles not configured"
                : profile
                  ? "Change username"
                  : "Set a username"
            }
            className="max-w-[130px] truncate text-[13px] font-medium text-bone transition hover:text-acid"
          >
            {profile?.username ?? (unavailable ? shortAddr(address!) : "Set username")}
          </button>
        )}
        {!unavailable && (
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-full p-1.5 text-faint transition-colors hover:text-bone"
            title={profile ? "Change username" : "Set username"}
            aria-label="Set username"
          >
            <PencilSimple size={14} />
          </button>
        )}
        <button
          onClick={() => disconnect()}
          className="rounded-full p-1.5 text-faint transition-colors hover:text-bone"
          title="Disconnect"
          aria-label="Disconnect wallet"
        >
          <SignOut size={14} />
        </button>
      </div>
      {modalOpen && <UsernameModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

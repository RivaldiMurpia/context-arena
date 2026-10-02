"use client";

import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import {
  Fingerprint,
  Lock,
  PencilSimple,
  SignOut,
  User,
  X,
} from "@phosphor-icons/react";
import { shortAddr } from "@/lib/chain";
import { isValidUsername } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { useWalletUI } from "@/components/WalletUI";
import { WalletAvatar } from "./WalletAvatar";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl border hairline bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[17px] font-bold tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ash transition-colors hover:text-bone"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * First-claim and one-time-rename modal.
 * mode "claim": the username is auto-generated (user_xxxxxxxx) — the user
 *   just signs to claim it.
 * mode "rename": one editable shot; afterwards the name locks forever.
 */
export function ProfileModal({
  mode,
  onClose,
}: {
  mode: "claim" | "rename";
  onClose: () => void;
}) {
  const { address } = useAccount();
  const { profile, generatedName, saveProfile, saving, error } = useProfile();
  const [name, setName] = useState(
    mode === "rename" ? (profile?.username ?? "") : ""
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    const finalName =
      mode === "claim" ? (generatedName ?? "") : name.trim();
    if (!isValidUsername(finalName)) {
      setLocalError("3–20 characters: letters, numbers, underscore.");
      return;
    }
    try {
      await saveProfile({
        username: finalName,
        bio: profile?.bio,
      });
      onClose();
    } catch {
      /* error is surfaced by the hook */
    }
  };

  return (
    <ModalShell
      title={mode === "claim" ? "Claim your username" : "Change username"}
      onClose={onClose}
    >
      {mode === "claim" ? (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-xl border hairline bg-void p-3.5">
            {address && <WalletAvatar wallet={address} size={40} />}
            <div className="min-w-0">
              <p className="tnum truncate font-mono text-[15px] font-semibold text-acid">
                {generatedName ?? "…"}
              </p>
              <p className="tnum text-[11px] text-faint">
                auto-generated for {address ? shortAddr(address) : ""}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ash">
            This name is yours after one free signature — no gas. You can
            change it <span className="text-bone">exactly once</span>,
            afterwards it&apos;s locked forever. Choose wisely on the rename.
          </p>
        </>
      ) : (
        <>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3.5">
            <Lock size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="text-[12.5px] leading-relaxed text-ash">
              This is your <span className="text-bone">one and only</span>{" "}
              rename. After this, your username is permanent.
            </p>
          </div>
          <label className="mt-4 block">
            <span className="tnum text-[10px] tracking-[0.18em] text-faint">
              NEW USERNAME
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={profile?.username}
              maxLength={20}
              autoFocus
              className="mt-1.5 h-11 w-full rounded-xl border hairline bg-void px-4 text-[14px] text-bone outline-none placeholder:text-faint focus:border-acid/60"
            />
          </label>
        </>
      )}
      {(localError || error) && (
        <p className="mt-2 text-[12px] text-red-400">{localError ?? error}</p>
      )}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-acid text-[14px] font-semibold text-void transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        <Fingerprint size={16} weight="bold" />
        {saving
          ? "Waiting for signature…"
          : mode === "claim"
            ? "Sign & claim"
            : "Sign & change forever"}
      </button>
    </ModalShell>
  );
}

/**
 * Identity-aware wallet button: claim prompt when new, username when set,
 * one-time rename pencil, disconnect.
 */
export function ProfileButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openWallet } = useWalletUI();
  const { profile, loading, unavailable, changesLeft } = useProfile();
  const [modal, setModal] = useState<"claim" | "rename" | null>(null);

  if (!isConnected) {
    return (
      <button
        onClick={openWallet}
        className="flex h-10 items-center gap-2 rounded-full bg-acid px-5 text-[13px] font-semibold whitespace-nowrap text-void transition hover:brightness-110 active:scale-[0.98]"
      >
        <User size={15} weight="bold" />
        Connect Wallet
      </button>
    );
  }

  const locked = !!profile && changesLeft === 0;

  return (
    <>
      <div className="flex h-10 items-center gap-1 rounded-full bg-elev py-1 pr-1 pl-4">
        {address && <WalletAvatar wallet={address} size={22} />}
        {loading ? (
          <span className="skeleton ml-1 h-4 w-16 rounded-md bg-white/[0.08]" />
        ) : profile ? (
          <span
            className="ml-1 max-w-[130px] truncate text-[13px] font-medium text-bone"
            title={address}
          >
            {profile.username}
          </span>
        ) : (
          !unavailable && (
            <button
              onClick={() => setModal("claim")}
              className="tnum ml-1 text-[13px] font-medium text-acid transition hover:brightness-110"
            >
              Claim username
            </button>
          )
        )}
        {unavailable ? (
          <span className="tnum ml-1 text-[13px] text-faint">
            {address ? shortAddr(address) : ""}
          </span>
        ) : profile ? (
          locked ? (
            <span
              className="rounded-full p-1.5 text-faint"
              title="Username locked — your one rename is used"
              aria-label="Username locked"
            >
              <Lock size={14} />
            </span>
          ) : (
            <button
              onClick={() => setModal("rename")}
              className="rounded-full p-1.5 text-faint transition-colors hover:text-bone"
              title="Rename (one time only)"
              aria-label="Rename username"
            >
              <PencilSimple size={14} />
            </button>
          )
        ) : null}
        <button
          onClick={() => disconnect()}
          className="rounded-full p-1.5 text-faint transition-colors hover:text-bone"
          title="Disconnect"
          aria-label="Disconnect wallet"
        >
          <SignOut size={14} />
        </button>
      </div>
      {modal && (
        <ProfileModal mode={modal} onClose={() => setModal(null)} />
      )}
    </>
  );
}

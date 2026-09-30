"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Browser, X } from "@phosphor-icons/react";
import { useAccount, useConnect } from "wagmi";
import { walletConnectEnabled } from "@/app/providers";

/**
 * Wallet picker: browser extension (injected) or mobile wallet via
 * WalletConnect QR scan. Shown from Header and BettingPanel connect buttons.
 */
export function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected } = useAccount();
  const wcReady = walletConnectEnabled();

  useEffect(() => {
    if (open && isConnected) onClose();
  }, [open, isConnected, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pick = (id: "injected" | "walletConnect") => {
    const c = connectors.find((x) => x.id === id);
    if (c) connect({ connector: c });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[320px] rounded-2xl border hairline bg-elev p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-semibold text-bone">
                Connect wallet
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-faint transition-colors hover:text-bone"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => pick("injected")}
                disabled={isPending}
                className="flex items-center gap-3 rounded-xl border hairline bg-void px-4 py-3 text-left transition-all hover:border-acid/50 active:scale-[0.98] disabled:opacity-50"
              >
                <Browser size={20} className="shrink-0 text-acid" />
                <span>
                  <span className="block text-[13px] font-medium text-bone">
                    Browser extension
                  </span>
                  <span className="block text-[11px] text-faint">
                    MetaMask, Rabby, OKX…
                  </span>
                </span>
              </button>
              {wcReady && (
                <button
                  onClick={() => pick("walletConnect")}
                  disabled={isPending}
                  className="flex items-center gap-3 rounded-xl border hairline bg-void px-4 py-3 text-left transition-all hover:border-acid/50 active:scale-[0.98] disabled:opacity-50"
                >
                  <QrCode size={20} className="shrink-0 text-acid" />
                  <span>
                    <span className="block text-[13px] font-medium text-bone">
                      Mobile wallet
                    </span>
                    <span className="block text-[11px] text-faint">
                      Scan QR with your phone
                    </span>
                  </span>
                </button>
              )}
            </div>
            {isPending && (
              <p className="tnum mt-3 text-center text-[11px] text-faint">
                Waiting for wallet…
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

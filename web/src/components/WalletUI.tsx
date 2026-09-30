"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { WalletModal } from "./WalletModal";

const WalletUIContext = createContext<{ openWallet: () => void }>({
  openWallet: () => {},
});

/**
 * Global wallet entry point. Opens the Reown AppKit modal when a
 * WalletConnect project ID is configured, otherwise falls back to the
 * simple injected-only picker (browser extension).
 */
export function WalletUIProvider({
  children,
  appKitOpen,
}: {
  children: ReactNode;
  appKitOpen: (() => void) | null;
}) {
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const openWallet = () => {
    if (appKitOpen) appKitOpen();
    else setFallbackOpen(true);
  };

  return (
    <WalletUIContext.Provider value={{ openWallet }}>
      {children}
      <WalletModal open={fallbackOpen} onClose={() => setFallbackOpen(false)} />
    </WalletUIContext.Provider>
  );
}

export function useWalletUI() {
  return useContext(WalletUIContext);
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState } from "react";
import { monadTestnet } from "@/lib/chain";
import { rpcTransport } from "@/lib/arena";
import {
  APP_METADATA,
  WC_PROJECT_ID,
  appKitChain,
  walletConnectReady,
} from "@/lib/wallet";
import { WalletUIProvider } from "@/components/WalletUI";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Built once. When a Reown project ID is configured we get the full
  // AppKit experience (wallet list, QR modal, mobile wallets). Otherwise
  // fall back to a plain injected-only wagmi config.
  const [wallet] = useState(() => {
    if (!walletConnectReady()) {
      return {
        config: createConfig({
          chains: [monadTestnet],
          connectors: [injected()],
          transports: { [monadTestnet.id]: rpcTransport },
          ssr: false,
        }),
        openAppKit: null as (() => void) | null,
      };
    }
    const wagmiAdapter = new WagmiAdapter({
      networks: [appKitChain],
      projectId: WC_PROJECT_ID,
      ssr: false,
      transports: { [monadTestnet.id]: rpcTransport },
    });
    const appKit = createAppKit({
      adapters: [wagmiAdapter],
      networks: [appKitChain],
      defaultNetwork: appKitChain,
      projectId: WC_PROJECT_ID,
      metadata: APP_METADATA,
      themeMode: "dark",
      themeVariables: { "--w3m-accent": "#a3e635" },
      features: {
        analytics: false,
        email: false,
        socials: false,
        onramp: false,
        swaps: false,
      },
    });
    return {
      config: wagmiAdapter.wagmiConfig,
      openAppKit: (() => appKit.open()) as () => void,
    };
  });

  return (
    <WagmiProvider config={wallet.config}>
      <QueryClientProvider client={queryClient}>
        <WalletUIProvider appKitOpen={wallet.openAppKit}>
          {children}
        </WalletUIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

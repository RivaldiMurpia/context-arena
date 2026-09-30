"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { useState } from "react";
import { monadTestnet } from "@/lib/chain";
import { rpcTransport } from "@/lib/arena";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() =>
    createConfig({
      chains: [monadTestnet],
      connectors: [
        injected(),
        // Mobile wallets via QR scan. Needs NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
        // (free project at https://cloud.reown.com). Omitted when unset.
        ...(WC_PROJECT_ID
          ? [
              walletConnect({
                projectId: WC_PROJECT_ID,
                showQrModal: true,
                metadata: {
                  name: "Context Arena",
                  description:
                    "AI trading agents battle live onchain. Spectators bet MON on the winner.",
                  url: "https://context-arena-steel.vercel.app",
                  icons: ["https://context-arena-steel.vercel.app/icon.png"],
                },
              }),
            ]
          : []),
      ],
      transports: {
        [monadTestnet.id]: rpcTransport,
      },
      ssr: false,
    })
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/** True when the WalletConnect (mobile QR) connector is configured. */
export function walletConnectEnabled(): boolean {
  return WC_PROJECT_ID.length > 0;
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState } from "react";
import { monadTestnet } from "@/lib/chain";
import { rpcTransport } from "@/lib/arena";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() =>
    createConfig({
      chains: [monadTestnet],
      connectors: [injected()],
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

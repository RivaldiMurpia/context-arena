import { defineChain } from "@reown/appkit/networks";

/** Reown (WalletConnect) project ID — public identifier, set via
 *  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Free at https://cloud.reown.com */
export const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export function walletConnectReady(): boolean {
  return WC_PROJECT_ID.length > 0;
}

/** Monad testnet in AppKit (CAIP) format. RPC goes through our own
 *  /api/rpc proxy so calls stay cached + Alchemy-backed. */
export const appKitChain = defineChain({
  id: 10143,
  caipNetworkId: "eip155:10143",
  chainNamespace: "eip155",
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://context-arena-steel.vercel.app/api/rpc"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

export const APP_METADATA = {
  name: "Context Arena",
  description:
    "AI trading agents battle live onchain. Spectators bet MON on the winner.",
  url: "https://context-arena-steel.vercel.app",
  icons: ["https://context-arena-steel.vercel.app/icon.png"],
};

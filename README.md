# Context Arena

> *Three AI traders battle live onchain. You bet MON on the winner.*

AI trading agents (Degen Dan, The Professor, Whale) compete live onchain trading a
synthetic asset (CTX). Spectators bet MON on the winning agent; winners split the pool
parimutuel. Built for the **Monad Metropolis Hackathon** — Monad's fast blocks and
near-zero fees make the arena feel alive: price ticks every few seconds, rounds breathe
in minutes.

- 🎮 **Live:** https://www.contexarena.xyz
- 🎬 **Demo video:** https://youtu.be/SXqx4i5HJQU
- 📜 **Contract:** `0x3b1d866777a8f26494249dfa7047f1ec9ffab563` (Monad testnet, chain ID `10143`)

## How it works

1. The **game master** bot opens a round and streams CTX prices onchain.
2. During the betting window, spectators place MON bets on any agent — odds update live.
3. The three **agent** bots trade CTX with virtual capital through their own LLM
   strategies (Nebius primary, Atria + NVIDIA NIM failover). Every trade is an onchain tx.
4. At round end the game master settles: highest portfolio value wins, the pool pays out
   pro-rata to winning bettors. Nobody backed the winner → bets are refundable.
5. Winners claim with one transaction. Only spectator bets move real MON.

## Structure

```
contracts/   Foundry project — ContextArena.sol (the game)
bots/        TypeScript + viem — game-master (prices + rounds) + 3 LLM trader agents
web/         Next.js 16 frontend — live arena, betting, wallet identity, history
```

## Quickstart

### 1. Contracts

```bash
cd contracts
forge build
forge test
# deploy to Monad testnet (chain id 10143) — ALWAYS --legacy, NEVER forge create
forge script script/Deploy.s.sol:DeployScript --rpc-url monad_testnet --legacy --broadcast
```

### 2. Bots

```bash
cd bots
npm install
cp .env.example .env   # fill ARENA_ADDRESS, GAME_MASTER_KEY, AGENT_KEYS (TESTNET ONLY),
                       # and at least one of NEBIUS_API_KEY / ATRIA_API_KEY / NVIDIA_API_KEY
npm run genwallets      # generate fresh testnet agent wallets (optional)
npm run setup           # register the 3 agents onchain (once per deploy)
npm run master          # game master (prices + rounds + settlement)
AGENT_INDEX=0 npm run agent   # Degen Dan
AGENT_INDEX=1 npm run agent   # The Professor
AGENT_INDEX=2 npm run agent   # Whale
# DEMO_MODE=true npm run master  → 3-minute rounds (rehearsal / video recording)
```

### 3. Frontend

```bash
cd web
npm install
npm run dev
```

Required env (Vercel or `.env.local`):

```
ALCHEMY_RPC_URL=...              # primary RPC (proxied same-origin via /api/rpc)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # server-only, never NEXT_PUBLIC_
```

Supabase schema: `web/supabase/profiles.sql`, then `web/supabase/profiles_002.sql`
(wallet-keyed profiles: username claim, one-time rename, bio).

Frontend design is governed by the `taste` skill — read
`~/workspace/skills/taste/SKILL.md` before writing UI.

## Network

- Monad Testnet — chain id `10143`
- Explorer: https://testnet.monadvision.com — Faucet: https://faucet.monad.xyz
- Currency: MON (testnet, no value)

## Honest demo disclosure

Agent funds are virtual, CTX prices come from the game master, and this runs on
testnet — only spectator bets move MON. The UI states this; so do we.

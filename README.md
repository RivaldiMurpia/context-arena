# Context Arena

> *Where AI traders battle — and you bet on the winner.*

AI trading agents (Degen Dan, The Professor, Whale) compete live onchain trading a
synthetic asset (CTX). Spectators bet MON on the winning agent; winners split the pool.
Built for the Monad Metropolis Hackathon on Monad testnet — every block is 0.5s, so the
arena actually feels alive.

## Structure

```
contracts/   Foundry project — ContextArena.sol (the game)
bots/        TypeScript bots — game-master (price feed + rounds) + 3 LLM trader agents
web/         Next.js frontend — live arena dashboard (chart, leaderboard, feed, betting)
```

Full technical blueprint: [`../goals/monad-metropolis-hackathon-build/files/BLUEPRINT.md`](../goals/monad-metropolis-hackathon-build/files/BLUEPRINT.md)

## Quickstart

### 1. Contracts

```bash
cd contracts
forge build
forge test
# deploy (Monad testnet, chain id 10143) — ALWAYS --legacy, NEVER forge create
forge script script/Deploy.s.sol:DeployScript --rpc-url monad_testnet --legacy --broadcast
```

### 2. Bots

```bash
cd bots
npm install
cp .env.example .env   # fill ARENA_ADDRESS, keys (TESTNET ONLY), GEMINI_API_KEY
npm run master         # game master (price + rounds)
AGENT_INDEX=0 npm run agent   # Degen Dan
AGENT_INDEX=1 npm run agent   # The Professor
AGENT_INDEX=2 npm run agent   # Whale
```

### 3. Frontend

```bash
cd web
npm install
npm run dev
```

Frontend design is governed by the `taste` skill (Leon's taste-skill installed globally):
read `~/.agents/skills/design-taste-frontend/SKILL.md` before writing UI, and run the
pre-flight checklist before calling any screen done.

## Network

- Monad Testnet — chain id `10143`, RPC `https://testnet-rpc.monad.xyz`
- Explorer: `https://testnet.monadvision.com` — Faucet: `https://faucet.monad.xyz`
- Currency: MON (testnet, no value)

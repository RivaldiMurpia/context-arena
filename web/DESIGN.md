# Context Arena — Visual Design Spec
Home / landing (catapult.trade-inspired, Broadcast Arena direction)
Approved direction: 1 Oct 2026. Taste gate: `~/workspace/skills/taste/SKILL.md` + pre-flight.

## Design read
Dark trading-platform home for crypto-native spectators/bettors, broadcast-arena
language. Tailwind v4 + sporty grotesque display type + motivated motion + data-dense tables.
Dials: VARIANCE 7 / MOTION 5 / DENSITY 7.

## Typography (next/font/google, never <link>)
- **Display:** Archivo variable (width axis) — Expanded 700/800 for hero + section
  headlines. Sports-broadcast energy; never Inter/Roboto/Arial for headlines.
- **Body:** Inter 400/500, line-height ≥ 1.5, max ~70ch for prose.
- **Numbers:** JetBrains Mono for ALL prices, portfolios, PnL, timers
  (`font-variant-numeric: tabular-nums`) — no jitter on live update.
- Headline weight 700–800 only where broadcast demands it; body never bold for emphasis.

## Color (dark-locked, single accent)
- `bg-0` page: #070907 (obsidian, green-tinted — never pure #000)
- `bg-1` surface: #0D110C · `bg-2` elevated: #141A11
- `text-1`: #F2F5EC (off-white, green-tinted — never pure #fff)
- `text-2`: #9AA392 (muted sage) · `text-3`: #6B7263 (faint)
- **Accent (locked, ~3 uses/viewport):** acid green #A3E635
- Down/danger: #F87171 (only for negative numbers) · Up = accent green
- Borders: white at 0.10–0.14 opacity, no hard black borders
- 60-30-10 by visual weight. Zero purple/indigo gradients. Promo banner: deep
  green-tinted radial wash at low opacity + live data — no neon outer glow.

## Layout — app shell (persistent, all routes)
- **Sidebar** fixed 248px: logo mark, nav (Home, Arena, History, Hall of Fame,
  How it Works) with Phosphor icons, LIVE-round mini card, footer links.
  < lg: icon rail 72px. < md: hidden → hamburger drawer.
- **Top bar** 68px single line: search (agents/rounds), "How it Works" ghost btn,
  "Faucet" (testnet MON) ghost btn, **Connect Wallet** pill in accent (→ username
  when connected). Mobile: search collapses to icon.
- **Main** `max-w-[1400px]`, asymmetric `2fr / 1fr` grid:
  - Promo carousel (full width, ~16:6): rotating slides — live round CTA, how
    parimutuel works, faucet. Left-aligned copy + right live mini-stats.
    Auto-advance 6s, progress dots, pause on hover.
  - **Agent table** (2fr, the star): Agent | Portfolio | PnL % | Trades.
    Row hover → highlight, click → /arena. Live-ticking tabular numbers.
  - **Hall of Fame panel** (1fr): last 5 round winners (agent, payout %),
    "Explore All" → /history. Not a card-in-card: flat rows with dividers.
  - How-it-works strip: 3 steps in one row separated by dividers (no 3-card slop).
  - Footer: socials, "Built on Monad", contract explorer link, honest game-master
    disclosure line.
- **Shape lock:** cards 16px · buttons full-pill · inputs 12px. One rule everywhere.
- **Asymmetry:** 2fr/1fr grid + left-aligned hero copy over right-aligned live stats.
  Max 1 eyebrow per 3 sections; no split-header pattern.

## Motion (motivated only, 150–250ms)
- Live number ticks: tabular-nums, no layout shift, color flash on change.
- LIVE badge: soft opacity pulse. Carousel: fade/slide 200ms.
- Hover ≤200ms (`translate-y-[-1px]` / bg shift); press `scale-[0.98]`.
- `prefers-reduced-motion`: all loops and reveals collapse to static.
- Easing: `cubic-bezier(0.16,1,0.3,1)` or spring (400/30). No bounce, no 500ms ease-in-out.

## Components to build
Sidebar, TopBar, ConnectButton, PromoCarousel, AgentTable, HallOfFamePanel,
LiveBadge, Stat (tabular number), HowItWorksStrip, Footer.
Icons: @phosphor-icons/react (verify in package.json), strokeWidth 1.5, one family.

## Copy register (broadcast, punchy)
- Hero: "Watch AI trade. Bet on the winner." / sub ≤20 words / CTA "Enter the Arena".
- No uplift slop ("seamless", "revolutionize"), no em-dash decoration, no emoji icons.

## States (every component)
Loading: skeleton matching final shape. Empty: composed + how to populate
(e.g. no bets yet → CTA to arena). Error: inline, actionable.

## Responsive (< 768px)
Single column, px-4; agent table → horizontal snap scroll; sidebar → drawer;
promo copy stacks above stats; CTA labels never wrap (≤3 words).

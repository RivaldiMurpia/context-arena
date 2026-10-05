# Bot VPS runbook (Civo)

Bots + game master jalan 24/7 di VPS biar arena tetap hidup selama judging week.
Kredit $250 Civo cukup buat instance kecil jalan berbulan-bulan.

## 1. Bikin instance di Civo

Dashboard → Compute → Create instance:

- **Image:** Ubuntu 22.04 (atau 24.04)
- **Size:** XS Small (1 vCPU / 1 GB) cukup, S Small (2 vCPU / 4 GB) lebih lega
- **Region:** bebas — Frankfurt (FRA1) oke
- **SSH key:** tambahkan public key laptop biar bisa SSH tanpa password
- **Firewall:** default cukup (script setup nutup semua kecuali SSH)

## 2. Jalankan script setup (sekali aja)

```bash
ssh civo@<IP-INSTANCE>
curl -sSL https://raw.githubusercontent.com/RivaldiMurpia/context-arena/main/deploy/civo-setup.sh | sudo bash
```

Script ini: install Node 22 → clone repo → `npm ci` → bikin 4 systemd unit
(master + 3 agent) → pasang watchdog (cek tiap 5 menit, restart bot kalau round stall)
→ firewall cuma buka SSH.

Service bot **belum** distart — nunggu `.env` diisi dulu.

## 3. Isi `.env` (di VPS, key nggak pernah lewat chat)

```bash
nano ~/context-arena/bots/.env
```

Copy nilainya dari `bots/.env` di laptop — yang wajib:

| Var | Isi |
|---|---|
| `ARENA_ADDRESS` | `0x3b1d866777a8f26494249dfa7047f1ec9ffab563` |
| `GAME_MASTER_KEY` | sama kayak di laptop |
| `AGENT_KEYS` | 3 key agent, sama kayak di laptop |
| `QWEN_API_KEY` | primary brain (fallback: Nebius/Atria/NVIDIA) |
| `RPC_URL` | boleh default, atau endpoint Alchemy/Chainstack kamu biar stabil |

Opsional — alert Telegram kalau watchdog deteksi stall:

```
TELEGRAM_BOT_TOKEN=...   # dari @BotFather
TELEGRAM_CHAT_ID=...     # chat id kamu
```

## 4. Fund wallet bot

4 wallet (1 master + 3 agent) butuh MON buat gas. Alamatnya kelihatan di log
pas pertama jalan (`journalctl -u context-arena-master -f`). Kirim secukupnya
dari wallet utama kamu (~5–10 MON per wallet buat berminggu-minggu).

## 5. Start

```bash
sudo systemctl enable --now context-arena-master \
  context-arena-agent-0 context-arena-agent-1 context-arena-agent-2
journalctl -u context-arena-master -f   # tonton round pertama jalan
systemctl list-timers | grep context-arena  # watchdog tiap 5 menit
```

## 6. Matikan bot di laptop

**Penting:** stop 4 proses bot di laptop biar nggak double-trading
jadi agent yang sama dari dua mesin.

## Perintah harian

```bash
systemctl status context-arena-master            # cek status
journalctl -u context-arena-agent-0 -n 50        # log agent
tail -f /var/log/context-arena/master.log       # log mentah
sudo systemctl restart context-arena-master     # restart manual
```

Watchdog otomatis restart semua service kalau nggak ada round baru
selama 30 menit, dan kirim alert Telegram kalau di-setup.
File-file deploy ada di folder `deploy/` repo ini.

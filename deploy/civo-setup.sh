#!/usr/bin/env bash
# Contex Arena — bot VPS one-shot setup (Civo / any Ubuntu 22.04+ box).
#
# Run ONCE on the fresh instance as root:
#   curl -sSL https://raw.githubusercontent.com/RivaldiMurpia/context-arena/main/deploy/civo-setup.sh | sudo bash
#
# What it does:
#   1. installs git, curl, ufw, Node.js 22 LTS
#   2. clones the repo into /home/<user>/context-arena, npm ci the bots
#   3. creates bots/.env from .env.example (YOU fill in the keys afterwards)
#   4. installs 4 systemd units: context-arena-master + context-arena-agent-{0,1,2}
#      (NOT started — start them after .env is filled)
#   5. installs the watchdog (healthcheck every 5 min, restarts bots on stall)
#   6. locks the firewall down to SSH only
#
# Idempotent: safe to re-run (it will git pull + npm ci again, rewrite units).

set -euo pipefail

APP_USER="${APP_USER:-civo}"   # Civo's default user; override: APP_USER=ubuntu curl ... | sudo bash
APP_HOME="$(eval echo "~${APP_USER}")"
APP_DIR="${APP_HOME}/context-arena"
REPO="https://github.com/RivaldiMurpia/context-arena.git"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo bash $0)"; exit 1
fi
if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "user '$APP_USER' does not exist. Set APP_USER to the login user."; exit 1
fi

echo "==> [1/6] base packages + Node 22"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ufw ca-certificates sudo
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "node $(node -v)"

echo "==> [2/6] repo -> ${APP_DIR}"
if [ ! -d "${APP_DIR}/.git" ]; then
  sudo -u "$APP_USER" git clone --depth 1 "$REPO" "$APP_DIR"
else
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only || true
fi

echo "==> [3/6] npm ci (bots)"
sudo -u "$APP_USER" bash -lc "cd '${APP_DIR}/bots' && npm ci --no-audit --no-fund"

echo "==> [4/6] .env skeleton"
ENV_FILE="${APP_DIR}/bots/.env"
if [ ! -f "$ENV_FILE" ]; then
  sudo -u "$APP_USER" cp "${APP_DIR}/bots/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "    created ${ENV_FILE} — FILL IT IN before starting the bots"
else
  echo "    ${ENV_FILE} already exists, left untouched"
fi

echo "==> [5/6] systemd units"
LOG_DIR="/var/log/context-arena"
mkdir -p "$LOG_DIR" "/var/lib/context-arena"
chown "${APP_USER}:${APP_USER}" "$LOG_DIR" "/var/lib/context-arena"

cat > /etc/systemd/system/context-arena-master.service <<EOF
[Unit]
Description=Contex Arena game master bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/bots
ExecStart=/usr/bin/npm run master
Restart=always
RestartSec=15
Environment=NODE_ENV=production
StandardOutput=append:${LOG_DIR}/master.log
StandardError=append:${LOG_DIR}/master.log

[Install]
WantedBy=multi-user.target
EOF

for i in 0 1 2; do
cat > /etc/systemd/system/context-arena-agent-${i}.service <<EOF
[Unit]
Description=Contex Arena trader agent ${i}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/bots
Environment=AGENT_INDEX=${i}
ExecStart=/usr/bin/npm run agent
Restart=always
RestartSec=15
Environment=NODE_ENV=production
StandardOutput=append:${LOG_DIR}/agent-${i}.log
StandardError=append:${LOG_DIR}/agent-${i}.log

[Install]
WantedBy=multi-user.target
EOF
done

# Watchdog: liveness probe every 5 min. Restarts bots if rounds stall.
cat > /etc/systemd/system/context-arena-watchdog.service <<EOF
[Unit]
Description=Contex Arena liveness watchdog (oneshot)

[Service]
Type=oneshot
User=${APP_USER}
WorkingDirectory=${APP_DIR}/bots
ExecStart=/usr/bin/npm run healthcheck
EOF

cat > /etc/systemd/system/context-arena-watchdog.timer <<EOF
[Unit]
Description=Run Contex Arena watchdog every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

# Let the watchdog restart bot units without a password.
cat > /etc/sudoers.d/context-arena <<EOF
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart context-arena-*, /bin/systemctl is-active context-arena-*
EOF
chmod 440 /etc/sudoers.d/context-arena
visudo -c -q

echo "==> [6/6] firewall (SSH only) + enable watchdog timer"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

systemctl daemon-reload
systemctl enable --now context-arena-watchdog.timer >/dev/null

echo
echo "=================================================================="
echo " DONE. The watchdog timer is running; the 4 bot services are NOT"
echo " started yet (waiting for your keys)."
echo
echo " Next steps (as ${APP_USER}):"
echo "   1. nano ${ENV_FILE}"
echo "      Copy values from your laptop's bots/.env:"
echo "      ARENA_ADDRESS, GAME_MASTER_KEY, AGENT_KEYS, QWEN_API_KEY (+fallbacks)"
echo "      Optional: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID for stall alerts"
echo "   2. Fund the 4 bot wallets with MON (gas) from your main wallet"
echo "   3. sudo systemctl enable --now context-arena-master \\"
echo "        context-arena-agent-0 context-arena-agent-1 context-arena-agent-2"
echo "   4. journalctl -u context-arena-master -f     # watch it come alive"
echo "   5. STOP the bots on your laptop (avoid double-trading as the same agents)"
echo "=================================================================="
